import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Raw shape coming from MySQL – field types may vary (Decimal objects, bigint, etc.)
type RawDatoRow = {
  device_id: unknown;
  ua: unknown; ub: unknown; uc: unknown;
  ia: unknown; ib: unknown; ic: unknown;
  time: Date | string;
  id_dispositivo: unknown;
  dispositivo: string;
  maquina: string;
  cliente: string;
};

type RawMaquinaRow = {
  id_maquina: unknown;
  maquina: string;
};

type RawClienteRow = {
  id_cliente: unknown;
  nombre: string;
  codigo: string | null;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v as string);
}

export type DatoRow = {
  device_id: number;
  ua: number | null; ub: number | null; uc: number | null;
  ia: number | null; ib: number | null; ic: number | null;
  time: Date;
  id_dispositivo: number;
  dispositivo: string;
  maquina: string;
  cliente: string;
};

export const datosRouter = createTRPCRouter({
  // Clientes que tienen al menos un dispositivo con datos reales en la tabla datos.
  getClientesConDatos: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.$queryRaw<RawClienteRow[]>`
      SELECT DISTINCT
        c.id_cliente,
        c.nombre,
        c.codigo
      FROM Dooble.clientes      c
      INNER JOIN Dooble.dispositivos dis ON dis.id_cliente = c.id_cliente
      INNER JOIN Dooble.datos        d   ON d.device_id   = dis.id
      ORDER BY c.nombre
    `;
    return rows.map((r) => ({
      id_cliente: Number(r.id_cliente),
      nombre:     r.nombre,
      codigo:     r.codigo ?? null,
    }));
  }),

  // Devuelve todas las máquinas que tienen dispositivos IoT registrados para un cliente.
  getMaquinasConDatos: publicProcedure
    .input(z.object({ id_cliente: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.$queryRaw<RawMaquinaRow[]>`
        SELECT DISTINCT
          dis.id_maquina,
          m.maquina_por_cliente AS maquina
        FROM Dooble.dispositivos dis
        INNER JOIN Dooble.maquinas m ON m.id_maquina = dis.id_maquina
        WHERE dis.id_cliente = ${input.id_cliente}
        ORDER BY m.maquina_por_cliente
      `;
      return rows.map((r) => ({
        id_maquina: Number(r.id_maquina),
        maquina: r.maquina,
      }));
    }),

  // Replica la lógica de get_datos_por_fecha pero para TODOS los dispositivos
  // de la máquina en un solo query (evita N llamadas al procedimiento).
  getDatosMaquinaFecha: publicProcedure
    .input(
      z.object({
        id_cliente: z.number().int().positive(),
        id_maquina: z.number().int().positive(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id_cliente, id_maquina, fecha } = input;

      // Día siguiente para el rango (mismo que el proc: d.time < p_fecha + INTERVAL 1 DAY)
      const nextDay = new Date(fecha + "T12:00:00Z");
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const fechaNext = nextDay.toISOString().slice(0, 10);

      const raw = await ctx.db.$queryRaw<RawDatoRow[]>`
        SELECT
          d.device_id,
          d.ua, d.ub, d.uc,
          d.ia, d.ib, d.ic,
          d.time,
          dis.id               AS id_dispositivo,
          dis.nombre           AS dispositivo,
          m.maquina_por_cliente AS maquina,
          c.nombre             AS cliente
        FROM Dooble.datos d
        INNER JOIN Dooble.dispositivos  dis ON dis.id        = d.device_id
        INNER JOIN Dooble.maquinas      m   ON m.id_maquina  = dis.id_maquina
        INNER JOIN Dooble.clientes      c   ON c.id_cliente  = dis.id_cliente
        WHERE dis.id_maquina = ${id_maquina}
          AND dis.id_cliente  = ${id_cliente}
          AND d.time >= ${fecha}
          AND d.time <  ${fechaNext}
        ORDER BY d.device_id, d.time
      `;

      return raw.map((r): DatoRow => ({
        device_id:     Number(r.device_id),
        ua: toNum(r.ua), ub: toNum(r.ub), uc: toNum(r.uc),
        ia: toNum(r.ia), ib: toNum(r.ib), ic: toNum(r.ic),
        time:          toDate(r.time),
        id_dispositivo: Number(r.id_dispositivo),
        dispositivo:   r.dispositivo,
        maquina:       r.maquina,
        cliente:       r.cliente,
      }));
    }),
});
