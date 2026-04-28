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

type RawSummaryDia = {
  id_dispositivo: unknown;
  dispositivo: string;
  inicio_func: Date | string | null;
  fin_func: Date | string | null;
  horas_trabajadas: unknown;
  kwh_total_a: unknown; kwh_total_b: unknown; kwh_total_c: unknown;
  kwh_load_a: unknown;  kwh_load_b: unknown;  kwh_load_c: unknown;
  kwh_noload_a: unknown; kwh_noload_b: unknown; kwh_noload_c: unknown;
};

export type SummaryDia = {
  id_dispositivo: number;
  dispositivo: string;
  inicio_func: Date | null;
  fin_func: Date | null;
  horas_trabajadas: number;
  kwh_total_a: number; kwh_total_b: number; kwh_total_c: number;
  kwh_load_a: number;  kwh_load_b: number;  kwh_load_c: number;
  kwh_noload_a: number; kwh_noload_b: number; kwh_noload_c: number;
  kwh_total_general: number;
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

  // Resumen diario por dispositivo: inicio/fin operación, horas trabajadas y
  // KWH por fase (fórmula 1.732 × V × I × pf, igual que get_datos_por_fecha).
  getSummaryDia: publicProcedure
    .input(
      z.object({
        id_cliente: z.number().int().positive(),
        id_maquina: z.number().int().positive(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { id_cliente, id_maquina, fecha } = input;
      const nextDay = new Date(fecha + "T12:00:00Z");
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const fechaNext = nextDay.toISOString().slice(0, 10);

      const rows = await ctx.db.$queryRaw<RawSummaryDia[]>`
        WITH base AS (
          SELECT
            dis.id                          AS id_dispositivo,
            dis.nombre                      AS dispositivo,
            COALESCE(d.ia, 0)               AS ia,
            COALESCE(d.ib, 0)               AS ib,
            COALESCE(d.ic, 0)               AS ic,
            d.time,
            COALESCE(dis.voltaje, 440)      AS voltaje,
            COALESCE(dis.LOAD_NOLOAD, 5)    AS load_noload,
            CASE WHEN COALESCE(d.ia,0) = 0 THEN 'OFF'
                 WHEN COALESCE(d.ia,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                 ELSE 'NOLOAD' END          AS estado_a,
            CASE WHEN COALESCE(d.ib,0) = 0 THEN 'OFF'
                 WHEN COALESCE(d.ib,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                 ELSE 'NOLOAD' END          AS estado_b,
            CASE WHEN COALESCE(d.ic,0) = 0 THEN 'OFF'
                 WHEN COALESCE(d.ic,0) >= COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                 ELSE 'NOLOAD' END          AS estado_c,
            CASE dis.linea
              WHEN 'A' THEN CASE WHEN COALESCE(d.ia,0)=0 THEN 'OFF' WHEN COALESCE(d.ia,0)>=COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD' ELSE 'NOLOAD' END
              WHEN 'B' THEN CASE WHEN COALESCE(d.ib,0)=0 THEN 'OFF' WHEN COALESCE(d.ib,0)>=COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD' ELSE 'NOLOAD' END
              WHEN 'C' THEN CASE WHEN COALESCE(d.ic,0)=0 THEN 'OFF' WHEN COALESCE(d.ic,0)>=COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD' ELSE 'NOLOAD' END
              ELSE CASE WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3=0 THEN 'OFF'
                        WHEN (COALESCE(d.ia,0)+COALESCE(d.ib,0)+COALESCE(d.ic,0))/3>=COALESCE(dis.LOAD_NOLOAD,5) THEN 'LOAD'
                        ELSE 'NOLOAD' END
            END AS estado
          FROM Dooble.datos d
          INNER JOIN Dooble.dispositivos dis ON dis.id        = d.device_id
          INNER JOIN Dooble.maquinas     m   ON m.id_maquina  = dis.id_maquina
          WHERE dis.id_maquina = ${id_maquina}
            AND dis.id_cliente = ${id_cliente}
            AND d.time >= ${fecha}
            AND d.time <  ${fechaNext}
        ),
        bounds AS (
          SELECT
            id_dispositivo,
            MIN(CASE WHEN estado <> 'OFF' THEN time END) AS primer_reg,
            MAX(CASE WHEN estado <> 'OFF' THEN time END) AS ultimo_reg
          FROM base
          GROUP BY id_dispositivo
        ),
        horas_cte AS (
          SELECT b.id_dispositivo, COUNT(*) * 30.0 / 3600.0 AS horas_trabajadas
          FROM base b
          INNER JOIN bounds bnd ON bnd.id_dispositivo = b.id_dispositivo
          WHERE b.time BETWEEN bnd.primer_reg AND bnd.ultimo_reg
          GROUP BY b.id_dispositivo
        )
        SELECT
          b.id_dispositivo,
          MAX(b.dispositivo)                                AS dispositivo,
          MAX(bnd.primer_reg)                               AS inicio_func,
          MAX(bnd.ultimo_reg)                               AS fin_func,
          ROUND(COALESCE(MAX(h.horas_trabajadas), 0), 2)   AS horas_trabajadas,
          ROUND(SUM((1.732 * b.ia * b.voltaje * CASE b.estado_a WHEN 'LOAD' THEN 0.9 WHEN 'NOLOAD' THEN 0.6 ELSE 0 END) / 1000.0 * (30.0/3600.0)), 2) AS kwh_total_a,
          ROUND(SUM((1.732 * b.ib * b.voltaje * CASE b.estado_b WHEN 'LOAD' THEN 0.9 WHEN 'NOLOAD' THEN 0.6 ELSE 0 END) / 1000.0 * (30.0/3600.0)), 2) AS kwh_total_b,
          ROUND(SUM((1.732 * b.ic * b.voltaje * CASE b.estado_c WHEN 'LOAD' THEN 0.9 WHEN 'NOLOAD' THEN 0.6 ELSE 0 END) / 1000.0 * (30.0/3600.0)), 2) AS kwh_total_c,
          ROUND(SUM(CASE WHEN b.estado_a = 'LOAD'   THEN (1.732 * b.ia * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_load_a,
          ROUND(SUM(CASE WHEN b.estado_b = 'LOAD'   THEN (1.732 * b.ib * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_load_b,
          ROUND(SUM(CASE WHEN b.estado_c = 'LOAD'   THEN (1.732 * b.ic * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_load_c,
          ROUND(SUM(CASE WHEN b.estado_a = 'NOLOAD' THEN (1.732 * b.ia * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_noload_a,
          ROUND(SUM(CASE WHEN b.estado_b = 'NOLOAD' THEN (1.732 * b.ib * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_noload_b,
          ROUND(SUM(CASE WHEN b.estado_c = 'NOLOAD' THEN (1.732 * b.ic * b.voltaje / 1000.0) * (30.0/3600.0) ELSE 0 END), 2) AS kwh_noload_c
        FROM base b
        INNER JOIN bounds bnd ON bnd.id_dispositivo = b.id_dispositivo
        LEFT  JOIN horas_cte h ON h.id_dispositivo = b.id_dispositivo
        GROUP BY b.id_dispositivo
        ORDER BY b.id_dispositivo
      `;

      return rows.map((r): SummaryDia => {
        const ta = Number(r.kwh_total_a ?? 0);
        const tb = Number(r.kwh_total_b ?? 0);
        const tc = Number(r.kwh_total_c ?? 0);
        return {
          id_dispositivo:   Number(r.id_dispositivo),
          dispositivo:      r.dispositivo,
          inicio_func:      r.inicio_func ? toDate(r.inicio_func as Date | string) : null,
          fin_func:         r.fin_func    ? toDate(r.fin_func    as Date | string) : null,
          horas_trabajadas: Number(r.horas_trabajadas ?? 0),
          kwh_total_a: ta, kwh_total_b: tb, kwh_total_c: tc,
          kwh_load_a:  Number(r.kwh_load_a  ?? 0),
          kwh_load_b:  Number(r.kwh_load_b  ?? 0),
          kwh_load_c:  Number(r.kwh_load_c  ?? 0),
          kwh_noload_a: Number(r.kwh_noload_a ?? 0),
          kwh_noload_b: Number(r.kwh_noload_b ?? 0),
          kwh_noload_c: Number(r.kwh_noload_c ?? 0),
          kwh_total_general: Math.round((ta + tb + tc) * 100) / 100,
        };
      });
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
