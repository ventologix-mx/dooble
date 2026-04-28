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
  corriente: unknown;
  estado: string;
  estado_anterior: string | null;
  amp_max: unknown;
  amp_ideal: unknown;
  load_noload: unknown;
  linea: string | null;
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
  return v instanceof Date ? v : new Date(v);
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
  corriente: number | null;
  estado: 'OFF' | 'LOAD' | 'NOLOAD';
  estado_anterior: 'OFF' | 'LOAD' | 'NOLOAD' | null;
  amp_max: number | null;
  amp_ideal: number | null;
  load_noload: number | null;
  linea: string | null;
};

type RawResumen30d = {
  total_kwh: unknown;
  avg_amp: unknown;
  horas_granallando: unknown;
};

export const datosRouter = createTRPCRouter({
  // Métricas agregadas de los últimos 30 días para la columna de comparación.
  // Usa LOAD_NOLOAD y corriente por línea directamente desde dispositivos.
  getResumen30Dias: publicProcedure
    .input(
      z.object({
        id_cliente: z.number().int().positive(),
        id_maquina: z.number().int().positive(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id_cliente, id_maquina, fecha } = input;

      const fechaFin = new Date(fecha + "T12:00:00Z");
      fechaFin.setUTCDate(fechaFin.getUTCDate() + 1);
      const fechaInicio = new Date(fechaFin);
      fechaInicio.setUTCDate(fechaInicio.getUTCDate() - 30);

      const fechaInicioStr = fechaInicio.toISOString().slice(0, 10);
      const fechaFinStr    = fechaFin.toISOString().slice(0, 10);

      const rows = await ctx.db.$queryRaw<RawResumen30d[]>`
        SELECT
          COALESCE(SUM(t.energy_kwh), 0)                                                     AS total_kwh,
          COALESCE(AVG(t.corriente),  0)                                                     AS avg_amp,
          COALESCE(SUM(CASE WHEN t.estado = 'LOAD' THEN t.dt_h ELSE 0 END), 0)              AS horas_granallando
        FROM (
          SELECT
            (
              (COALESCE(d.ua,0)*COALESCE(d.ia,0) + COALESCE(d.ub,0)*COALESCE(d.ib,0) + COALESCE(d.uc,0)*COALESCE(d.ic,0)) / 1000.0
            ) * (TIMESTAMPDIFF(SECOND, LAG(d.time) OVER w, d.time) / 3600.0)                AS energy_kwh,
            CASE dis.linea
              WHEN 'A' THEN COALESCE(d.ia, 0)
              WHEN 'B' THEN COALESCE(d.ib, 0)
              WHEN 'C' THEN COALESCE(d.ic, 0)
              ELSE (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0)) / 3.0
            END                                                                              AS corriente,
            CASE dis.linea
              WHEN 'A' THEN
                CASE WHEN COALESCE(d.ia,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ia,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'B' THEN
                CASE WHEN COALESCE(d.ib,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ib,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'C' THEN
                CASE WHEN COALESCE(d.ic,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ic,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              ELSE
                CASE WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 = 0 THEN 'OFF'
                     WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
            END                                                                              AS estado,
            TIMESTAMPDIFF(SECOND, LAG(d.time) OVER w, d.time) / 3600.0                      AS dt_h
          FROM Dooble.datos d
          INNER JOIN Dooble.dispositivos dis ON dis.id = d.device_id
          WHERE dis.id_maquina = ${id_maquina}
            AND dis.id_cliente = ${id_cliente}
            AND d.time >= ${fechaInicioStr}
            AND d.time <  ${fechaFinStr}
          WINDOW w AS (PARTITION BY d.device_id ORDER BY d.time)
        ) t
        WHERE t.dt_h IS NOT NULL AND t.dt_h > 0 AND t.dt_h < 1
      `;

      const r = rows[0];
      return {
        total_kwh:         Math.round(Number(r?.total_kwh ?? 0) * 10) / 10,
        avg_amp:           Math.round(Number(r?.avg_amp ?? 0) * 10) / 10,
        horas_granallando: Math.round(Number(r?.horas_granallando ?? 0) * 10) / 10,
      };
    }),

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

  // Todos los datos de un cliente por fecha, sin requerir id_maquina.
  // Útil cuando dispositivos.id_maquina es NULL (cliente sin máquina registrada).
  getDatosClienteFecha: publicProcedure
    .input(
      z.object({
        id_cliente: z.number().int().positive(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id_cliente, fecha } = input;
      const nextDay = new Date(fecha + "T12:00:00Z");
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const fechaNext = nextDay.toISOString().slice(0, 10);

      const raw = await ctx.db.$queryRaw<RawDatoRow[]>`
        SELECT
          t.device_id,
          t.ua, t.ub, t.uc,
          t.ia, t.ib, t.ic,
          t.time,
          t.id_dispositivo,
          t.dispositivo,
          t.maquina,
          t.cliente,
          t.corriente,
          t.estado,
          t.amp_max,
          t.amp_ideal,
          t.load_noload,
          t.linea,
          LAG(t.estado) OVER (PARTITION BY t.device_id ORDER BY t.time) AS estado_anterior
        FROM (
          SELECT
            d.device_id,
            d.ua, d.ub, d.uc,
            d.ia, d.ib, d.ic,
            d.time,
            dis.id                                      AS id_dispositivo,
            dis.nombre                                  AS dispositivo,
            COALESCE(m.maquina_por_cliente, dis.nombre) AS maquina,
            c.nombre                                    AS cliente,
            dis.amp_max,
            dis.amp_ideal,
            dis.LOAD_NOLOAD                             AS load_noload,
            dis.linea,
            CASE dis.linea
              WHEN 'A' THEN COALESCE(d.ia, 0)
              WHEN 'B' THEN COALESCE(d.ib, 0)
              WHEN 'C' THEN COALESCE(d.ic, 0)
              ELSE (COALESCE(d.ia,0) + COALESCE(d.ib,0) + COALESCE(d.ic,0)) / 3.0
            END AS corriente,
            CASE dis.linea
              WHEN 'A' THEN
                CASE WHEN COALESCE(d.ia,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ia,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'B' THEN
                CASE WHEN COALESCE(d.ib,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ib,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'C' THEN
                CASE WHEN COALESCE(d.ic,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ic,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              ELSE
                CASE WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 = 0 THEN 'OFF'
                     WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
            END AS estado
          FROM Dooble.datos d
          INNER JOIN Dooble.dispositivos  dis ON dis.id       = d.device_id
          LEFT  JOIN Dooble.maquinas      m   ON m.id_maquina = dis.id_maquina
          INNER JOIN Dooble.clientes      c   ON c.id_cliente = dis.id_cliente
          WHERE dis.id_cliente = ${id_cliente}
            AND d.time >= ${fecha}
            AND d.time <  ${fechaNext}
        ) t
        ORDER BY t.device_id, t.time
      `;

      return raw.map((r): DatoRow => ({
        device_id:      Number(r.device_id),
        ua: toNum(r.ua), ub: toNum(r.ub), uc: toNum(r.uc),
        ia: toNum(r.ia), ib: toNum(r.ib), ic: toNum(r.ic),
        time:           toDate(r.time),
        id_dispositivo: Number(r.id_dispositivo),
        dispositivo:    r.dispositivo,
        maquina:        r.maquina,
        cliente:        r.cliente,
        corriente:      toNum(r.corriente),
        estado:         (r.estado ?? 'OFF') as 'OFF' | 'LOAD' | 'NOLOAD',
        estado_anterior: r.estado_anterior as 'OFF' | 'LOAD' | 'NOLOAD' | null,
        amp_max:        toNum(r.amp_max),
        amp_ideal:      toNum(r.amp_ideal),
        load_noload:    toNum(r.load_noload),
        linea:          r.linea ?? null,
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
          t.device_id,
          t.ua, t.ub, t.uc,
          t.ia, t.ib, t.ic,
          t.time,
          t.id_dispositivo,
          t.dispositivo,
          t.maquina,
          t.cliente,
          t.corriente,
          t.estado,
          t.amp_max,
          t.amp_ideal,
          t.load_noload,
          t.linea,
          LAG(t.estado) OVER (PARTITION BY t.device_id ORDER BY t.time) AS estado_anterior
        FROM (
          SELECT
            d.device_id,
            d.ua, d.ub, d.uc,
            d.ia, d.ib, d.ic,
            d.time,
            dis.id               AS id_dispositivo,
            dis.nombre           AS dispositivo,
            m.maquina_por_cliente AS maquina,
            c.nombre             AS cliente,
            dis.amp_max,
            dis.amp_ideal,
            dis.LOAD_NOLOAD      AS load_noload,
            dis.linea,
            CASE dis.linea
              WHEN 'A' THEN COALESCE(d.ia, 0)
              WHEN 'B' THEN COALESCE(d.ib, 0)
              WHEN 'C' THEN COALESCE(d.ic, 0)
              ELSE (COALESCE(d.ia,0) + COALESCE(d.ib,0) + COALESCE(d.ic,0)) / 3.0
            END AS corriente,
            CASE dis.linea
              WHEN 'A' THEN
                CASE WHEN COALESCE(d.ia,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ia,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'B' THEN
                CASE WHEN COALESCE(d.ib,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ib,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              WHEN 'C' THEN
                CASE WHEN COALESCE(d.ic,0) = 0 THEN 'OFF'
                     WHEN COALESCE(d.ic,0) >= COALESCE(dis.LOAD_NOLOAD, 5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
              ELSE
                CASE WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 = 0 THEN 'OFF'
                     WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3.0 >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                     ELSE 'NOLOAD' END
            END AS estado
          FROM Dooble.datos d
          INNER JOIN Dooble.dispositivos  dis ON dis.id        = d.device_id
          INNER JOIN Dooble.maquinas      m   ON m.id_maquina  = dis.id_maquina
          INNER JOIN Dooble.clientes      c   ON c.id_cliente  = dis.id_cliente
          WHERE dis.id_maquina = ${id_maquina}
            AND dis.id_cliente  = ${id_cliente}
            AND d.time >= ${fecha}
            AND d.time <  ${fechaNext}
        ) t
        ORDER BY t.device_id, t.time
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
        corriente:     toNum(r.corriente),
        estado:        (r.estado ?? 'OFF') as 'OFF' | 'LOAD' | 'NOLOAD',
        estado_anterior: r.estado_anterior as 'OFF' | 'LOAD' | 'NOLOAD' | null,
        amp_max:       toNum(r.amp_max),
        amp_ideal:     toNum(r.amp_ideal),
        load_noload:   toNum(r.load_noload),
        linea:         r.linea ?? null,
      }));
    }),
});
