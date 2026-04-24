import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import {
  createTRPCRouter,
  publicProcedure,
  superAdminProcedure,
} from "~/server/api/trpc";

const auth0 = new Auth0Client();

export const authRouter = createTRPCRouter({
  getMe: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user.email) return null;

    const email = ctx.session.user.email;
    const domain = email.split("@")[1] ?? "";

    return ctx.db.usuarios.findFirst({
      where: {
        activo: 1,
        OR: [{ email }, { dominio: domain }],
      },
      select: {
        id: true,
        rol: true,
        id_cliente: true,
        clientes: { select: { id_cliente: true, nombre: true } },
      },
    });
  }),

  listUsuarios: superAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.usuarios.findMany({
      orderBy: [{ activo: "desc" }, { created_at: "desc" }],
      include: { clientes: { select: { id_cliente: true, nombre: true } } },
    });
  }),

  createUsuario: superAdminProcedure
    .input(
      z.object({
        email: z.string().email().nullable(),
        dominio: z.string().min(3).nullable(),
        rol: z.enum(["super_admin", "cliente"]),
        id_cliente: z.number().int().positive().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.email && !input.dominio) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debes indicar un email o un dominio.",
        });
      }
      if (input.rol === "cliente" && !input.id_cliente) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Los clientes deben tener un cliente asignado.",
        });
      }

      return ctx.db.usuarios.create({
        data: {
          email: input.email,
          dominio: input.dominio,
          rol: input.rol,
          id_cliente: input.id_cliente,
        },
      });
    }),

  toggleActivo: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.usuarios.findUniqueOrThrow({
        where: { id: input.id },
      });
      return ctx.db.usuarios.update({
        where: { id: input.id },
        data: { activo: current.activo === 1 ? 0 : 1 },
      });
    }),

  deleteUsuario: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.usuarios.delete({ where: { id: input.id } });
    }),
});
