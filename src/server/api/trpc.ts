import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { db } from "~/server/db";

const auth0 = new Auth0Client();

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth0.getSession();
  return {
    db,
    session: session ?? null,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const enforceAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user.email) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const email = ctx.session.user.email;
  const domain = email.split("@")[1] ?? "";

  const usuario = await ctx.db.usuarios.findFirst({
    where: {
      activo: 1,
      OR: [{ email }, { dominio: domain }],
    },
    include: {
      clientes: { select: { id_cliente: true, nombre: true } },
    },
  });

  if (!usuario) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, usuario } });
});

const enforceSuperAdmin = enforceAuthed.unstable_pipe(({ ctx, next }) => {
  if (ctx.usuario.rol !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(enforceAuthed);
export const superAdminProcedure = t.procedure
  .use(timingMiddleware)
  .use(enforceSuperAdmin);
