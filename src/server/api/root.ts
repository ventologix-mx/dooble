import { postRouter } from "~/server/api/routers/post";
import { visitasRouter } from "~/server/api/routers/visitas";
import { clientesRouter } from "~/server/api/routers/clientes";
import { maquinasRouter } from "~/server/api/routers/maquinas";
import { granallasRouter } from "~/server/api/routers/granallas";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  visitas: visitasRouter,
  clientes: clientesRouter,
  maquinas: maquinasRouter,
  granallas: granallasRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
