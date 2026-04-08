import { z } from "zod";
import {
  visitas_encabezado_evaluacion_estado,
  visitas_encabezado_evaluacion_eficiencia,
  visitas_compras_proveedor,
  visitas_granulometria_tipo_muestra,
} from "../../../../generated/prisma";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// ── Input schemas ──────────────────────────────────────────────────────────

const ampSchema = z.object({
  num_turbina: z.number(),
  amperaje_real: z.number(),
});

const granulometriaSchema = z.object({
  tipo_muestra: z.nativeEnum(visitas_granulometria_tipo_muestra),
  malla: z.string(),
  peso_gramos: z.number(),
});

const maquinaInput = z.object({
  id_maquina: z.number(),
  horometro_lectura: z.number(),
  evaluacion_estado: z.nativeEnum(visitas_encabezado_evaluacion_estado),
  evaluacion_eficiencia: z.nativeEnum(visitas_encabezado_evaluacion_eficiencia),
  recomendaciones_maquina: z.string().optional(),
  recomendaciones_proceso: z.string().optional(),
  comentarios: z.string().optional(),
  kg_en_maquina: z.number().optional(),
  kg_piso: z.number().optional(),
  kg_recuperada: z.number().optional(),
  amperajes: z.array(ampSchema),
  granulometria: z.array(granulometriaSchema),
  performance_real: z.number().optional(),
  performance_ideal: z.number().optional(),
  kg_hr: z.number().optional(),
  granalla_instalada: z
    .object({
      id_granalla: z.number().optional(),
      nombre_granalla: z.string(),
      medida: z.string().optional(),
      detalle_material: z.string().optional(),
      comentarios: z.string().optional(),
    })
    .optional(),
});

const createVisitaInput = z.object({
  id_cliente: z.number(),
  fecha: z.string(), // ISO "YYYY-MM-DD"
  stockBodega: z.array(
    z.object({
      id_granalla: z.number(),
      kg_bodega: z.number(),
      notas: z.string().optional(),
    }),
  ),
  compras: z.array(
    z.object({
      proveedor: z.nativeEnum(visitas_compras_proveedor),
      id_granalla: z.number().optional(),
      nombre_granalla_competencia: z.string().optional(),
      kg_comprados: z.number(),
      orden_venta: z.string().optional(),
      notas: z.string().optional(),
    }),
  ),
  maquinas: z.array(maquinaInput),
});

export const visitasRouter = createTRPCRouter({
  // Obtiene todos los datos de un reporte de visita por id
  getReporte: publicProcedure
    .input(z.object({ id_visita: z.number() }))
    .query(async ({ ctx, input }) => {
      const visita = await ctx.db.visitas_encabezado.findUnique({
        where: { id_visita: input.id_visita },
        include: {
          maquinas_maestra: {
            include: {
              clientes: true,
              contactos_maquina: true,
              maquinas_turbinas: true,
              maquinas_especificaciones: true,
            },
          },
          visitas_amperajes: { orderBy: { num_turbina: "asc" } },
          visitas_granalla_instalada: {
            include: { granallas: true },
          },
          visitas_granulometria: { orderBy: { malla: "asc" } },
          visitas_lecturas_kghr: { orderBy: { fecha_lectura: "asc" } },
          visitas_performance_grano: true,
          visitas_stock_maquina: true,
        },
      });

      if (!visita) return null;

      // Visita anterior de la misma máquina para calcular delta horómetro
      const visitaAnterior = visita.id_maquina
        ? await ctx.db.visitas_encabezado.findFirst({
            where: {
              id_maquina: visita.id_maquina,
              id_visita: { lt: input.id_visita },
            },
            orderBy: { id_visita: "desc" },
            select: {
              id_visita: true,
              fecha_visita: true,
              horometro_lectura: true,
              consecutivo_reporte: true,
            },
          })
        : null;

      // Granulometría ideal de la granalla instalada
      const granallasInstaladas = visita.visitas_granalla_instalada;
      const idGranallas = granallasInstaladas
        .map((g) => g.id_granalla)
        .filter((id): id is number => id !== null);

      const granulometriaIdeal =
        idGranallas.length > 0
          ? await ctx.db.granallas_granulometria.findMany({
              where: { id_granalla: { in: idGranallas }, tipo: "MIX_IDEAL" },
              orderBy: { malla_mm: "desc" },
            })
          : [];

      return { visita, visitaAnterior, granulometriaIdeal };
    }),

  // Lista de visitas de una máquina (para navegación entre reportes)
  listByMaquina: publicProcedure
    .input(z.object({ id_maquina: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.visitas_encabezado.findMany({
        where: { id_maquina: input.id_maquina },
        orderBy: { fecha_visita: "desc" },
        select: {
          id_visita: true,
          fecha_visita: true,
          consecutivo_reporte: true,
          horometro_lectura: true,
          evaluacion_estado: true,
        },
      });
    }),

  // Lista de todas las visitas (para pantalla home)
  listRecientes: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          id_cliente: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.visitas_encabezado.findMany({
        where: input?.id_cliente
          ? { maquinas_maestra: { id_cliente: input.id_cliente } }
          : undefined,
        orderBy: { fecha_visita: "desc" },
        take: input?.limit ?? 20,
        select: {
          id_visita: true,
          fecha_visita: true,
          consecutivo_reporte: true,
          horometro_lectura: true,
          evaluacion_estado: true,
          numero_maquina_inf: true,
          maquinas_maestra: {
            select: {
              maquina_por_cliente: true,
              tipo_maquina: true,
              clientes: { select: { nombre: true } },
            },
          },
        },
      });
    }),

  // Crea una visita completa (todas las tablas relacionadas)
  create: publicProcedure
    .input(createVisitaInput)
    .mutation(async ({ ctx, input }) => {
      const fecha = new Date(input.fecha);

      return ctx.db.$transaction(async (tx) => {
        const visitasCreadas: { id_visita: number; id_maquina: number }[] = [];

        // 1. Stock bodega (upsert por unique constraint cliente+fecha+granalla)
        for (const sb of input.stockBodega) {
          await tx.visitas_stock_bodega.upsert({
            where: {
              id_cliente_fecha_visita_id_granalla: {
                id_cliente: input.id_cliente,
                fecha_visita: fecha,
                id_granalla: sb.id_granalla,
              },
            },
            update: { kg_bodega: sb.kg_bodega, notas: sb.notas },
            create: {
              id_cliente: input.id_cliente,
              fecha_visita: fecha,
              id_granalla: sb.id_granalla,
              kg_bodega: sb.kg_bodega,
              notas: sb.notas,
            },
          });
        }

        // 2. Compras del periodo
        for (const c of input.compras) {
          await tx.visitas_compras.create({
            data: {
              id_cliente: input.id_cliente,
              fecha_visita: fecha,
              proveedor: c.proveedor,
              id_granalla: c.id_granalla,
              nombre_granalla_competencia: c.nombre_granalla_competencia,
              kg_comprados: c.kg_comprados,
              orden_venta: c.orden_venta,
              notas: c.notas,
            },
          });
        }

        // 3. Una visita por máquina
        for (const m of input.maquinas) {
          // Consecutivo: count de visitas anteriores + 1
          const count = await tx.visitas_encabezado.count({
            where: { id_maquina: m.id_maquina },
          });

          const maquinaInfo = await tx.maquinas_maestra.findUnique({
            where: { id_maquina: m.id_maquina },
            select: { numero_inplant: true },
          });

          // Encabezado
          const visita = await tx.visitas_encabezado.create({
            data: {
              id_maquina: m.id_maquina,
              numero_maquina_inf: maquinaInfo?.numero_inplant ?? null,
              fecha_visita: fecha,
              horometro_lectura: m.horometro_lectura,
              consecutivo_reporte: count + 1,
              evaluacion_estado: m.evaluacion_estado,
              evaluacion_eficiencia: m.evaluacion_eficiencia,
              recomendaciones_maquina: m.recomendaciones_maquina,
              recomendaciones_proceso: m.recomendaciones_proceso,
              comentarios: m.comentarios,
            },
          });

          // Stock en máquina
          if (
            m.kg_en_maquina !== undefined ||
            m.kg_piso !== undefined ||
            m.kg_recuperada !== undefined
          ) {
            await tx.visitas_stock_maquina.create({
              data: {
                id_visita: visita.id_visita,
                kg_en_maquina: m.kg_en_maquina,
                kg_piso: m.kg_piso,
                kg_recuperada: m.kg_recuperada,
              },
            });
          }

          // Amperajes
          for (const amp of m.amperajes) {
            if (amp.amperaje_real > 0) {
              await tx.visitas_amperajes.create({
                data: {
                  id_visita: visita.id_visita,
                  num_turbina: amp.num_turbina,
                  amperaje_real: amp.amperaje_real,
                },
              });
            }
          }

          // Granulometría
          for (const g of m.granulometria) {
            if (g.peso_gramos > 0) {
              await tx.visitas_granulometria.create({
                data: {
                  id_visita: visita.id_visita,
                  tipo_muestra: g.tipo_muestra,
                  malla: g.malla,
                  peso_gramos: g.peso_gramos,
                },
              });
            }
          }

          // Performance
          if (m.performance_real !== undefined || m.performance_ideal !== undefined) {
            const real = m.performance_real ?? 0;
            const ideal = m.performance_ideal ?? 0;
            await tx.visitas_performance_grano.create({
              data: {
                id_visita: visita.id_visita,
                porcentaje_real: real,
                porcentaje_ideal: ideal,
                variacion: real - ideal,
              },
            });
          }

          // KG/HR
          if (m.kg_hr !== undefined && m.kg_hr > 0) {
            await tx.visitas_lecturas_kghr.create({
              data: {
                id_visita: visita.id_visita,
                fecha_lectura: fecha,
                kg_hr: m.kg_hr,
              },
            });
          }

          // Granalla instalada
          if (m.granalla_instalada) {
            await tx.visitas_granalla_instalada.create({
              data: {
                id_visita: visita.id_visita,
                id_granalla: m.granalla_instalada.id_granalla,
                nombre_granalla: m.granalla_instalada.nombre_granalla,
                medida: m.granalla_instalada.medida,
                detalle_material: m.granalla_instalada.detalle_material,
                comentarios: m.granalla_instalada.comentarios,
              },
            });
          }

          visitasCreadas.push({
            id_visita: visita.id_visita,
            id_maquina: m.id_maquina,
          });
        }

        return visitasCreadas;
      });
    }),
});
