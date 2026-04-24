import { visitasRouter } from "~/server/api/routers/visitas";
import { clientesRouter } from "~/server/api/routers/clientes";
import { maquinasRouter } from "~/server/api/routers/maquinas";
import { granallasRouter } from "~/server/api/routers/granallas";
import { authRouter } from "~/server/api/routers/auth";
import { datosRouter } from "~/server/api/routers/datos";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  visitas: visitasRouter,
  clientes: clientesRouter,
  maquinas: maquinasRouter,
  granallas: granallasRouter,
  datos: datosRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
