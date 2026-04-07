import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const maquinasRouter = createTRPCRouter({
  listByCliente: publicProcedure
    .input(z.object({ id_cliente: z.number() }))
    .query(async ({ ctx, input }) => {
      const maquinas = await ctx.db.maquinas_maestra.findMany({
        where: { id_cliente: input.id_cliente },
        orderBy: { numero_inplant: "asc" },
        include: {
          maquinas_turbinas: true,
          maquinas_especificaciones: true,
        },
      });

      // Última visita + granalla instalada por máquina
      const results = await Promise.all(
        maquinas.map(async (m) => {
          const ultimaVisita = await ctx.db.visitas_encabezado.findFirst({
            where: { id_maquina: m.id_maquina },
            orderBy: { fecha_visita: "desc" },
            select: {
              id_visita: true,
              fecha_visita: true,
              horometro_lectura: true,
              visitas_granalla_instalada: {
                select: {
                  id_granalla: true,
                  nombre_granalla: true,
                  medida: true,
                  detalle_material: true,
                  codigo_inplant: true,
                  comentarios: true,
                },
                take: 1,
              },
            },
          });

          const granInstalada =
            ultimaVisita?.visitas_granalla_instalada[0] ?? null;

          return {
            id_maquina: m.id_maquina,
            numero_inplant: m.numero_inplant,
            maquina_por_cliente: m.maquina_por_cliente,
            tipo_maquina: m.tipo_maquina,
            marca: m.marca,
            modelo: m.modelo,
            cantidad_turbinas: m.maquinas_turbinas?.cantidad_turbinas ?? 2,
            amp_vacio: m.maquinas_turbinas?.amp_vacio
              ? Number(m.maquinas_turbinas.amp_vacio)
              : null,
            amp_maximo: m.maquinas_turbinas?.amp_maximo
              ? Number(m.maquinas_turbinas.amp_maximo)
              : null,
            ultima_visita_fecha: ultimaVisita?.fecha_visita ?? null,
            ultima_visita_horometro: ultimaVisita?.horometro_lectura
              ? Number(ultimaVisita.horometro_lectura)
              : null,
            granalla_instalada: granInstalada,
          };
        }),
      );

      return results;
    }),
});
