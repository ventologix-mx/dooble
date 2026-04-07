import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const granallasRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const granallas = await ctx.db.granallas.findMany({
      orderBy: { nominacion_comercial: "asc" },
      select: {
        id_granalla: true,
        codigo_dooble: true,
        nominacion_comercial: true,
        medidas: true,
        material_granalla: true,
        forma_granalla: true,
        fabricante: true,
      },
    });
    return granallas;
  }),
});
