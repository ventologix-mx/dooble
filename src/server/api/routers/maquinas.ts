import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

type RawUltimaVisita = {
  id_visita: bigint;
  id_maquina: number;
  fecha_visita: Date;
  horometro_lectura: unknown;
};

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

      if (maquinas.length === 0) return [];

      const maquinaIds = maquinas.map((m) => m.id_maquina);

      // Una query: última visita por máquina usando MAX + JOIN
      const placeholders = maquinaIds.map(() => "?").join(", ");
      const ultimasVisitas = await ctx.db.$queryRawUnsafe<RawUltimaVisita[]>(
        `SELECT ve.id_visita, ve.id_maquina, ve.fecha_visita, ve.horometro_lectura
         FROM Dooble.visitas_encabezado ve
         INNER JOIN (
           SELECT id_maquina, MAX(fecha_visita) AS max_fecha
           FROM Dooble.visitas_encabezado
           WHERE id_maquina IN (${placeholders})
           GROUP BY id_maquina
         ) latest ON ve.id_maquina = latest.id_maquina
                AND ve.fecha_visita = latest.max_fecha`,
        ...maquinaIds,
      );

      const visitaPorMaquina = new Map(
        ultimasVisitas.map((v) => [v.id_maquina, v]),
      );

      // Una query: granalla instalada para esas visitas
      const visitaIds = ultimasVisitas.map((v) => Number(v.id_visita));
      const granallas =
        visitaIds.length > 0
          ? await ctx.db.visitas_granalla_instalada.findMany({
              where: { id_visita: { in: visitaIds } },
              select: {
                id_visita: true,
                id_granalla: true,
                nombre_granalla: true,
                medida: true,
                detalle_material: true,
                codigo_inplant: true,
                comentarios: true,
              },
            })
          : [];

      // Tomar la primera granalla por visita (equivale a take: 1)
      const granallaPorVisita = new Map<number, (typeof granallas)[0]>();
      for (const g of granallas) {
        if (g.id_visita !== null && !granallaPorVisita.has(g.id_visita)) {
          granallaPorVisita.set(g.id_visita, g);
        }
      }

      return maquinas.map((m) => {
        const visita = visitaPorMaquina.get(m.id_maquina) ?? null;
        const idVisita = visita ? Number(visita.id_visita) : null;
        const granInstalada =
          idVisita !== null ? (granallaPorVisita.get(idVisita) ?? null) : null;

        return {
          id_maquina: m.id_maquina,
          numero_inplant: m.numero_inplant,
          maquina_por_cliente: m.maquina_por_cliente,
          tipo_maquina: m.tipo_maquina,
          marca: m.marca,
          modelo: m.modelo,
          cantidad_turbinas: m.maquinas_turbinas?.cantidad_turbinas ?? 2,
          potencia_hp: m.maquinas_turbinas?.potencia_hp
            ? Number(m.maquinas_turbinas.potencia_hp)
            : null,
          amp_vacio: m.maquinas_turbinas?.amp_vacio
            ? Number(m.maquinas_turbinas.amp_vacio)
            : null,
          amp_maximo: m.maquinas_turbinas?.amp_maximo
            ? Number(m.maquinas_turbinas.amp_maximo)
            : null,
          ultima_visita_fecha: visita?.fecha_visita ?? null,
          ultima_visita_horometro: visita?.horometro_lectura
            ? Number(visita.horometro_lectura)
            : null,
          granalla_instalada: granInstalada,
        };
      });
    }),
});
