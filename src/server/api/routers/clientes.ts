import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const clientesRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const clientes = await ctx.db.clientes.findMany({
      orderBy: { nombre: "asc" },
      include: {
        maquinas_maestra: {
          select: { id_maquina: true },
        },
      },
    });

    // Última visita por cliente
    const ids = clientes.map((c) => c.id_cliente);
    const ultimasVisitas = await ctx.db.visitas_encabezado.findMany({
      where: { maquinas_maestra: { id_cliente: { in: ids } } },
      orderBy: { fecha_visita: "desc" },
      select: {
        fecha_visita: true,
        maquinas_maestra: { select: { id_cliente: true } },
      },
    });

    return clientes.map((c) => {
      const ultima = ultimasVisitas.find(
        (v) => v.maquinas_maestra?.id_cliente === c.id_cliente,
      );
      return {
        id_cliente: c.id_cliente,
        nombre: c.nombre,
        codigo: c.codigo,
        num_maquinas: c.maquinas_maestra.length,
        ultima_visita: ultima?.fecha_visita ?? null,
      };
    });
  }),
});
