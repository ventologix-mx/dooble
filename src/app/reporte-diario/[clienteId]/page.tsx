"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import { api } from "~/trpc/react";
import type { DatoRow } from "~/server/api/routers/datos";

// ─── Color palette para turbinas ─────────────────────────────────────────────
const PALETTE = [
  "#1e6abf", "#00a87c", "#8a7200",
  "#9b27af", "#d4600a", "#0e7a8f", "#2e8b57", "#d63030",
];

// ─── Chart geometry ───────────────────────────────────────────────────────────
const CW = 920;
const CH = 224;
const ML = 38, MR = 12, MT = 14, MB = 30;
const PW = CW - ML - MR;
const PH = CH - MT - MB;

// Gantt — mismos márgenes horizontales que AmperageChart para alinear ejes de tiempo
const GML = 38, GMR = 12, GMT = 8, GMB = 28;
const GPW = CW - GML - GMR;
const ROW_H = 26, ROW_GAP = 8;

const BW = 280, BH = 170;
const BML = 10, BMR = 10, BMT = 18, BMB = 36;
const BPW = BW - BML - BMR;
const BPH = BH - BMT - BMB;

// ─── Helpers de tiempo ────────────────────────────────────────────────────────
function minsFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function formatHHMM(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Tipos para datos procesados ──────────────────────────────────────────────
type Series = { key: string; color: string; pts: { t: number; v: number }[] };
type Turb   = {
  key: string; color: string;
  kwh: number; kwhLoad: number; kwhUnload: number; kwhPerHr: number;
  horas: number; pctDia: number;
  horasNoload: number; pctNoload: number; pctOff: number;
};

type ChartData = {
  series: Series[];
  activeDots: Record<string, number[]>;
  colors: Record<string, string>;
  turbs: Turb[];
  totalKwh: number; totalKwhLoad: number; totalKwhUnload: number;
  pctLoad: number; pctUnload: number;
  totalHoras: number;
  promHoras: number;
  avgAmpMedio: number;
  tStart: number;
  tTotal: number;
  majorTicks: { offset: number; label: string }[];
  minorTicks: { offset: number }[];
  yMax: number;
  inicioOp: string;
  finOp: string;
  cliente: string;
  maquina: string;
};

// ─── Procesamiento de datos crudos ────────────────────────────────────────────
function processData(rows: DatoRow[], ampVacio: number, maxTurbinas?: number): ChartData {
  const byDevice = new Map<string, DatoRow[]>();
  for (const row of rows) {
    const key = row.dispositivo;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key)!.push(row);
  }

  let deviceKeys = [...byDevice.keys()].sort();
  // Elimina dispositivos fantasma limitando al número real de turbinas
  if (maxTurbinas != null && deviceKeys.length > maxTurbinas) {
    deviceKeys = deviceKeys.slice(0, maxTurbinas);
    for (const k of [...byDevice.keys()]) {
      if (!deviceKeys.includes(k)) byDevice.delete(k);
    }
  }

  const colors: Record<string, string> = {};
  deviceKeys.forEach((k, i) => { colors[k] = PALETTE[i % PALETTE.length]!; });

  const filteredRows = [...byDevice.values()]
    .flat()
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  // Inicio/Fin Op: primer y último registro del día con cualquier corriente ≠ 0
  const nonZeroRows = filteredRows.filter(
    r => (r.ia ?? 0) !== 0 || (r.ib ?? 0) !== 0 || (r.ic ?? 0) !== 0,
  );
  const inicioOp = nonZeroRows.length > 0
    ? formatHHMM(minsFromMidnight(nonZeroRows[0]!.time))
    : "—";
  const finOp = nonZeroRows.length > 0
    ? formatHHMM(minsFromMidnight(nonZeroRows[nonZeroRows.length - 1]!.time))
    : "—";

  const allTimes = filteredRows.map(r => minsFromMidnight(r.time));
  const rawTMin = allTimes.length ? Math.min(...allTimes) : 0;
  const rawTMax = allTimes.length ? Math.max(...allTimes) : 1440;
  const tStart = Math.max(0, Math.floor(rawTMin / 60) * 60 - 60);
  const tEnd   = Math.min(1440, Math.ceil(rawTMax / 60) * 60 + 60);
  const tTotal = Math.max(tEnd - tStart, 120);

  const majorTicks: { offset: number; label: string }[] = [];
  const minorTicks: { offset: number }[] = [];
  for (let t = 0; t <= tTotal; t += 30) {
    const abs = tStart + t;
    if (t % 60 === 0) majorTicks.push({ offset: t, label: formatHHMM(abs) });
    else minorTicks.push({ offset: t });
  }

  const series: Series[] = deviceKeys.map((key) => {
    const devRows = byDevice.get(key)!;
    const pts = devRows.map(r => ({
      t: minsFromMidnight(r.time) - tStart,
      v: ((r.ia ?? 0) + (r.ib ?? 0) + (r.ic ?? 0)) / 3,
    }));
    return { key, color: colors[key]!, pts };
  });

  const allAmps = series.flatMap(s => s.pts.map(p => p.v));
  const yMax = Math.max(24, Math.ceil((Math.max(...allAmps, 0) + 2) / 4) * 4);

  // Un punto por lectura LOAD en el Gantt; ancho = 0.5 min (1/2880 del día)
  const activeDots: Record<string, number[]> = {};
  for (const [key, devRows] of byDevice) {
    activeDots[key] = devRows
      .filter(r => ((r.ia ?? 0) + (r.ib ?? 0) + (r.ic ?? 0)) / 3 > ampVacio)
      .map(r => minsFromMidnight(r.time) - tStart);
  }

  let sumAmp = 0, countAmp = 0;
  const turbs: Turb[] = deviceKeys.map((key) => {
    const devRows = byDevice.get(key)!;
    let activeMs = 0, unloadMs = 0, kwhLoad = 0, kwhUnload = 0;
    for (let i = 0; i < devRows.length - 1; i++) {
      const r1 = devRows[i]!, r2 = devRows[i + 1]!;
      const dtMs = r2.time.getTime() - r1.time.getTime();
      const dtH  = dtMs / 3_600_000;
      const ia = ((r1.ia ?? 0) + (r2.ia ?? 0)) / 2;
      const ib = ((r1.ib ?? 0) + (r2.ib ?? 0)) / 2;
      const ic = ((r1.ic ?? 0) + (r2.ic ?? 0)) / 2;
      const ua = ((r1.ua ?? 0) + (r2.ua ?? 0)) / 2;
      const ub = ((r1.ub ?? 0) + (r2.ub ?? 0)) / 2;
      const uc = ((r1.uc ?? 0) + (r2.uc ?? 0)) / 2;
      const avgI = (ia + ib + ic) / 3;
      const kwh  = ((ua * ia + ub * ib + uc * ic) / 1000) * dtH;
      if (avgI > ampVacio) {
        kwhLoad  += kwh;
        activeMs += dtMs;
      } else {
        kwhUnload += kwh;
        unloadMs  += dtMs;
      }
    }
    devRows.forEach(r => {
      const v = ((r.ia ?? 0) + (r.ib ?? 0) + (r.ic ?? 0)) / 3;
      sumAmp += v; countAmp++;
    });
    const horas       = activeMs / 3_600_000;
    const horasNoload = unloadMs / 3_600_000;
    const kwhLoadR    = round1(kwhLoad);
    const kwhUnloadR  = round1(kwhUnload);
    const kwhPerHr    = horas > 0 ? round1(kwhLoadR / horas) : 0;
    const pctLoad     = round1((horas / 24) * 100);
    const pctNoload   = round1((horasNoload / 24) * 100);
    return {
      key, color: colors[key]!,
      kwh:         round1(kwhLoad + kwhUnload),
      kwhLoad:     kwhLoadR,
      kwhUnload:   kwhUnloadR,
      kwhPerHr,
      horas:       round1(horas),
      pctDia:      pctLoad,
      horasNoload: round1(horasNoload),
      pctNoload,
      pctOff:      round1(Math.max(0, 100 - pctLoad - pctNoload)),
    };
  });

  const totalHoras     = turbs.reduce((s, t) => s + t.horas, 0);
  const totalKwh       = round1(turbs.reduce((s, t) => s + t.kwh, 0));
  const totalKwhLoad   = round1(turbs.reduce((s, t) => s + t.kwhLoad, 0));
  const totalKwhUnload = round1(turbs.reduce((s, t) => s + t.kwhUnload, 0));
  const pctLoad        = totalKwh > 0 ? round1((totalKwhLoad  / totalKwh) * 100) : 0;
  const pctUnload      = totalKwh > 0 ? round1((totalKwhUnload / totalKwh) * 100) : 0;
  const avgAmpMedio    = countAmp > 0 ? round1(sumAmp / countAmp) : 0;

  return {
    series, activeDots, colors, turbs,
    totalKwh, totalKwhLoad, totalKwhUnload, pctLoad, pctUnload,
    totalHoras: round1(totalHoras),
    promHoras: turbs.length > 0 ? round1(totalHoras / turbs.length) : 0,
    avgAmpMedio,
    tStart, tTotal, majorTicks, minorTicks,
    yMax,
    inicioOp, finOp,
    cliente: filteredRows[0]?.cliente ?? "",
    maquina: filteredRows[0]?.maquina ?? "",
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Sub-componentes de chart ─────────────────────────────────────────────────

function AmperageChart({ data, ampMax, ampIdeal, ampVacio }: {
  data: ChartData; ampMax: number; ampIdeal: number; ampVacio: number;
}) {
  const { series, majorTicks, minorTicks, tTotal, yMax } = data;
  const Y_TICKS = Array.from({ length: Math.floor(yMax / 4) + 1 }, (_, i) => i * 4);

  function xp(t: number) { return ML + (t / tTotal) * PW; }
  function yp(v: number) { return MT + PH - (v / yMax) * PH; }
  function toPath(pts: { t: number; v: number }[]) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${xp(p.t).toFixed(1)},${yp(p.v).toFixed(1)}`).join(" ");
  }

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
        {Y_TICKS.map((y) => (
          <line key={y} x1={ML} y1={yp(y)} x2={CW - MR} y2={yp(y)}
            stroke={y === 0 ? "#9aa8b8" : "#dde3ec"} strokeWidth={y === 0 ? 0.8 : 0.6}
            strokeDasharray={y > 0 ? "3,3" : undefined} />
        ))}
        {majorTicks.map(({ offset }) => (
          <line key={offset} x1={xp(offset)} y1={MT} x2={xp(offset)} y2={CH - MB}
            stroke="#dde3ec" strokeWidth={0.6} strokeDasharray="3,3" />
        ))}
        {minorTicks.map(({ offset }) => (
          <line key={offset} x1={xp(offset)} y1={MT} x2={xp(offset)} y2={CH - MB}
            stroke="#eef1f6" strokeWidth={0.5} />
        ))}
        <line x1={ML} y1={yp(ampMax)}   x2={CW - MR} y2={yp(ampMax)}   stroke="#7ec8e3" strokeWidth={1} strokeDasharray="6,3" />
        <line x1={ML} y1={yp(ampIdeal)} x2={CW - MR} y2={yp(ampIdeal)} stroke="#d4a017" strokeWidth={1} strokeDasharray="6,3" />
        <line x1={ML} y1={yp(ampVacio)} x2={CW - MR} y2={yp(ampVacio)} stroke="#b0bac8" strokeWidth={1} strokeDasharray="6,3" />
        {series.map((s) => (
          <path key={s.key} d={toPath(s.pts)} fill="none"
            stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {Y_TICKS.map((y) => (
          <text key={y} x={ML - 4} y={yp(y) + 3.5} textAnchor="end" fontSize={7.5} fill="#8898a8">{y}A</text>
        ))}
        {majorTicks.map(({ offset, label }) => (
          <text key={offset} x={xp(offset)} y={CH - MB + 12} textAnchor="middle" fontSize={7.5} fill="#8898a8">{label}</text>
        ))}
        <line x1={ML}      y1={MT}      x2={ML}      y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
        <line x1={CW - MR} y1={MT}      x2={CW - MR} y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
        <line x1={ML}      y1={CH - MB} x2={CW - MR} y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
        <line x1={ML}      y1={MT}      x2={CW - MR} y2={MT}      stroke="#b0bac8" strokeWidth={0.5} />
      </svg>
    </div>
  );
}

function GanttChart({ data }: { data: ChartData }) {
  const { activeDots, colors, majorTicks, minorTicks, tTotal } = data;
  const rowKeys = Object.keys(activeDots).sort().reverse();
  const GH = GMT + rowKeys.length * (ROW_H + ROW_GAP) - ROW_GAP + GMB;

  function gx(t: number) { return GML + (t / tTotal) * GPW; }
  // Ancho de cada punto proporcional a la frecuencia de registro: 1/(24*60*2) día = 0.5 min
  const dotW = Math.max(1.5, (0.5 / tTotal) * GPW);

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${CW} ${GH}`} className="w-full">
        {majorTicks.map(({ offset }) => (
          <line key={offset} x1={gx(offset)} y1={GMT} x2={gx(offset)} y2={GH - GMB}
            stroke="#dde3ec" strokeWidth={0.6} strokeDasharray="3,3" />
        ))}
        {minorTicks.map(({ offset }) => (
          <line key={offset} x1={gx(offset)} y1={GMT} x2={gx(offset)} y2={GH - GMB}
            stroke="#eef1f6" strokeWidth={0.5} />
        ))}
        {rowKeys.map((key, rowIdx) => {
          const y = GMT + rowIdx * (ROW_H + ROW_GAP);
          const color = colors[key]!;
          const dots = activeDots[key] ?? [];
          return (
            <g key={key}>
              <rect x={GML} y={y} width={GPW} height={ROW_H} fill="#eff2f7" rx={2} />
              {dots.map((t, i) => (
                <rect key={i} x={gx(t) - dotW / 2} y={y} width={dotW}
                  height={ROW_H} fill={color} rx={0.5} />
              ))}
              <text x={GML - 5} y={y + ROW_H / 2 + 3.5} textAnchor="end"
                fontSize={8} fontWeight="700" fill="#3d4f63">{key}</text>
              <text x={CW - GMR + 5} y={y + ROW_H / 2 + 3.5} textAnchor="start"
                fontSize={8} fontWeight="700" fill="#3d4f63">{key}</text>
            </g>
          );
        })}
        {majorTicks.map(({ offset, label }) => (
          <text key={offset} x={gx(offset)} y={GH - GMB + 12}
            textAnchor="middle" fontSize={7.5} fill="#8898a8">{label}</text>
        ))}
        <line x1={GML} y1={GH - GMB} x2={CW - GMR} y2={GH - GMB} stroke="#b0bac8" strokeWidth={0.8} />
      </svg>
    </div>
  );
}

function TripleStateChart({ turbs }: { turbs: Turb[] }) {
  const barW = Math.floor((BPW - (turbs.length - 1) * 14) / turbs.length);
  const spacing = barW + 14;
  const startX = BML + (BPW - (turbs.length * barW + (turbs.length - 1) * 14)) / 2;
  const legendY = BH - 10;

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = BMT + BPH - (v / 100) * BPH;
          return <line key={v} x1={BML} y1={y} x2={BW - BMR} y2={y}
            stroke="#dde3ec" strokeWidth={0.6} strokeDasharray="2,3" />;
        })}
        {turbs.map((t, i) => {
          const x = startX + i * spacing;
          const loadH   = (t.pctDia    / 100) * BPH;
          const noloadH = (t.pctNoload / 100) * BPH;
          const offH    = BPH - loadH - noloadH;
          return (
            <g key={t.key}>
              {/* OFF — sin registro */}
              <rect x={x} y={BMT} width={barW} height={offH > 0 ? offH : 0} fill="#dde3ec" rx={2} />
              {/* NOLOAD — encendida en vacío */}
              <rect x={x} y={BMT + offH} width={barW} height={noloadH > 0 ? noloadH : 0}
                fill={t.color} fillOpacity={0.38} />
              {/* LOAD — granallado efectivo */}
              <rect x={x} y={BMT + offH + noloadH} width={barW} height={loadH > 0 ? loadH : 0}
                fill={t.color} />
              {loadH > 8 && (
                <text x={x + barW / 2} y={BMT + offH + noloadH + loadH / 2 + 3}
                  textAnchor="middle" fontSize={7.5} fontWeight="700" fill="#fff">
                  {t.pctDia}%
                </text>
              )}
              <text x={x + barW / 2} y={BMT + BPH + 12} textAnchor="middle" fontSize={7} fill="#3d4f63">
                {t.key.length > 8 ? t.key.slice(0, 8) + "…" : t.key}
              </text>
            </g>
          );
        })}
        <line x1={BML} y1={BMT + BPH} x2={BW - BMR} y2={BMT + BPH} stroke="#9aa8b8" strokeWidth={0.8} />
        {/* Leyenda estados */}
        <rect x={BML}      y={legendY - 5} width={8} height={8} fill={PALETTE[0]} />
        <text x={BML + 10} y={legendY}     fontSize={6.5} fill="#5a6a7a">LOAD</text>
        <rect x={BML + 36} y={legendY - 5} width={8} height={8} fill={PALETTE[0]} fillOpacity={0.38} />
        <text x={BML + 46} y={legendY}     fontSize={6.5} fill="#5a6a7a">NOLOAD</text>
        <rect x={BML + 92} y={legendY - 5} width={8} height={8} fill="#dde3ec" />
        <text x={BML + 102} y={legendY}    fontSize={6.5} fill="#5a6a7a">OFF</text>
      </svg>
    </div>
  );
}

function MaqRow({ label, value, extra, extraVal, unit, highlight = false }: {
  label: string; value: string | number; extra: string;
  extraVal: string | number; unit: string; highlight?: boolean;
}) {
  return (
    <tr className="border-b border-[#dde3ec]">
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[10px] font-semibold text-[#5a6a7a]">{label}</td>
      <td className="border-r border-[#dde3ec] px-2 py-[5px] text-[10px] text-[#2d3f52]">{value}</td>
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[10px] font-semibold text-[#5a6a7a]">{extra}</td>
      <td className={`border-r border-[#dde3ec] px-2 py-[5px] text-right text-[10px] font-bold ${highlight ? "text-[#1a5fa8]" : "text-[#2d3f52]"}`}>{extraVal}</td>
      <td className="px-2 py-[5px] text-[10px] text-[#8898a8]">{unit}</td>
    </tr>
  );
}

// ─── Página principal (envuelve en Suspense para useSearchParams) ─────────────

function ReporteContent() {
  const router = useRouter();
  const { clienteId } = useParams<{ clienteId: string }>();
  const searchParams = useSearchParams();

  const numClienteId = parseInt(clienteId ?? "0", 10);

  const maquinaParam = searchParams.get("maquina");
  const fechaParam   = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  const { data: maquinasIoT, isLoading: loadingMaq } = api.datos.getMaquinasConDatos.useQuery(
    { id_cliente: numClienteId },
    { enabled: numClienteId > 0 },
  );

  const sinMaquina = !loadingMaq && (maquinasIoT?.length ?? 0) === 0;

  const selectedMaquinaId = maquinaParam
    ? parseInt(maquinaParam, 10)
    : (maquinasIoT?.[0]?.id_maquina ?? null);

  const { data: maquinasSpecs } = api.maquinas.listByCliente.useQuery(
    { id_cliente: numClienteId },
    { enabled: numClienteId > 0 },
  );
  const specs     = maquinasSpecs?.find((m) => m.id_maquina === selectedMaquinaId);
  const ampVacio  = specs?.amp_vacio  ?? 5;
  const ampMaximo = specs?.amp_maximo ?? 24;
  const ampIdeal  = ampMaximo > 0 ? Math.round(ampMaximo * 0.85) : 20;

  const { data: rawRows, isLoading: loadingDatos } = api.datos.getDatosMaquinaFecha.useQuery(
    {
      id_cliente: numClienteId,
      id_maquina: selectedMaquinaId ?? 0,
      fecha: fechaParam,
    },
    { enabled: numClienteId > 0 && selectedMaquinaId != null },
  );

  const { data: rawRowsCliente, isLoading: loadingDatosCliente } =
    api.datos.getDatosClienteFecha.useQuery(
      { id_cliente: numClienteId, fecha: fechaParam },
      { enabled: numClienteId > 0 && sinMaquina },
    );

  const { data: resumen30d } = api.datos.getResumen30Dias.useQuery(
    {
      id_cliente: numClienteId,
      id_maquina: selectedMaquinaId ?? 0,
      fecha: fechaParam,
      amp_vacio: ampVacio,
    },
    { enabled: numClienteId > 0 && selectedMaquinaId != null },
  );

  const efectiveRows = rawRows ?? rawRowsCliente;

  const chartData = useMemo(() => {
    if (!efectiveRows?.length) return null;
    return processData(efectiveRows, ampVacio, specs?.cantidad_turbinas ?? undefined);
  }, [efectiveRows, ampVacio, specs?.cantidad_turbinas]);

  function navigate(maquinaId: number, fecha: string) {
    void router.push(`/reporte-diario/${clienteId}?maquina=${maquinaId}&fecha=${fecha}`);
  }

  const isLoading = loadingMaq || loadingDatos || loadingDatosCliente;
  const clienteNombre = chartData?.cliente ?? maquinasIoT?.[0]?.maquina ?? rawRowsCliente?.[0]?.cliente ?? `Cliente ${clienteId}`;
  const maquinaNombre = chartData?.maquina ?? (maquinasIoT?.find(m => m.id_maquina === selectedMaquinaId)?.maquina ?? "");
  const fechaDisplay  = new Date(fechaParam + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#eef1f6] py-6 print:bg-white print:py-0">
      {/* Breadcrumb + controles */}
      <div className="mx-auto mb-4 flex max-w-[1120px] flex-wrap items-center gap-2 px-4 text-[12px] text-[#8898a8] print:hidden">
        <Link href="/home" className="hover:text-[#1a5fa8]">Inicio</Link>
        <span>/</span>
        <Link href="/reporte-diario" className="hover:text-[#1a5fa8]">Reporte Granallado</Link>
        <span>/</span>
        <span className="font-semibold text-[#3d4f63]">{clienteNombre || `Cliente ${clienteId}`}</span>
        <div className="flex-1" />

        {maquinasIoT && maquinasIoT.length > 1 && (
          <select
            value={selectedMaquinaId ?? ""}
            onChange={(e) => navigate(Number(e.target.value), fechaParam)}
            className="rounded border border-[#dde3ec] bg-white px-2 py-1 text-[11px] text-[#3d4f63] focus:border-[#1a5fa8] focus:outline-none"
          >
            {maquinasIoT.map((m) => (
              <option key={m.id_maquina} value={m.id_maquina}>{m.maquina}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={fechaParam}
          onChange={(e) => {
            if (sinMaquina) void router.push(`/reporte-diario/${clienteId}?fecha=${e.target.value}`);
            else if (selectedMaquinaId) navigate(selectedMaquinaId, e.target.value);
          }}
          className="rounded border border-[#dde3ec] bg-white px-2 py-1 text-[11px] text-[#3d4f63] focus:border-[#1a5fa8] focus:outline-none"
        />

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded border border-[#dde3ec] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mx-auto flex max-w-[1120px] items-center justify-center py-24 px-4">
          <div className="flex flex-col items-center gap-3 text-[#8898a8]">
            <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-semibold">Cargando datos…</span>
          </div>
        </div>
      )}

      {/* Sin datos para la fecha */}
      {!isLoading && (selectedMaquinaId ?? sinMaquina) && !chartData && (
        <div className="mx-4 flex max-w-[1120px] flex-col items-center justify-center rounded-xl border border-dashed border-[#dde3ec] bg-white py-24 text-center sm:mx-auto">
          <svg className="mb-3 h-10 w-10 text-[#aab4c0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-semibold text-[#8898a8]">
            Sin datos de telemetría para el {fechaDisplay}
          </p>
          <p className="mt-1 text-xs text-[#aab4c0]">Selecciona otra fecha o verifica la conexión del dispositivo.</p>
        </div>
      )}

      {/* ── Reporte ───────────────────────────────────────────────────────────── */}
      {!isLoading && chartData && (
        <div className="mx-auto max-w-[1120px] overflow-hidden rounded-xl bg-white shadow-lg print:rounded-none print:shadow-none">

          {/* Header */}
          <div className="flex items-stretch border-b-2 border-[#dde3ec]">
            <div className="flex flex-1 items-center justify-center px-4 py-2.5">
              <h1 className="text-center text-[13px] font-extrabold tracking-wide text-[#2d3f52] uppercase">
                REPORTE GRANALLADO DIARIO &nbsp;·&nbsp; {maquinaNombre}
              </h1>
            </div>
          </div>

          {/* Cliente + Fecha */}
          <div className="flex items-center justify-between border-b border-[#dde3ec] bg-[#f0f4f8] px-5 py-1.5">
            <span className="text-[15px] font-bold text-[#2d3f52]">{chartData.cliente}</span>
            <span className="text-[12px] font-semibold tracking-wide text-[#566778]">
              FECHA:&nbsp; {fechaDisplay}
            </span>
          </div>

          {/* Info + Resumen */}
          <div className="grid grid-cols-[1.35fr_1fr] divide-x divide-[#dde3ec] border-b border-[#dde3ec]">
            {/* Specs */}
            <table className="w-full">
              <tbody>
                <MaqRow label="Máquina"    value={maquinaNombre}
                  extra="Amp Máximo"  extraVal={ampMaximo}   unit="A" />
                <MaqRow label="Turbinas"   value={chartData.turbs.length}
                  extra="Amp Ideal"   extraVal={ampIdeal}    unit="A"  highlight />
                <MaqRow label="Voltaje"    value="440"
                  extra="Amp Vacío"   extraVal={ampVacio}    unit="A" />
                {specs?.potencia_hp != null && (
                  <MaqRow label="Potencia HP" value={specs.potencia_hp}
                    extra="Turbinas"  extraVal={specs.cantidad_turbinas ?? "—"} unit="" />
                )}
                <MaqRow label="Inicio Op." value={chartData.inicioOp}
                  extra="Fin Op."    extraVal={chartData.finOp} unit="" />
              </tbody>
            </table>

            {/* Resumen operación */}
            <div className="flex flex-col">
              <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1.5 text-center text-[10px] font-bold tracking-wider text-[#1a5fa8] uppercase">
                Resumen de Operación
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                    <th className="px-3 py-1 text-left font-semibold text-[#8898a8]"></th>
                    <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">Valores del día</th>
                    <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">Últ. 30 días</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Consumo KWh</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">{chartData.totalKwh}</td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? resumen30d.total_kwh : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Amp. Medio</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">{chartData.avgAmpMedio} A</td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? `${resumen30d.avg_amp} A` : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Horas Granallando</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">{chartData.totalHoras} h</td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? `${resumen30d.horas_granallando} h` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-4 p-4">
            {/* Amperaje */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#2d3f52]">Turbinas: Variación de Amperajes</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-[#5a6a7a]">
                  {chartData.series.map((s) => (
                    <span key={s.key} className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: s.color }} />
                      {s.key}
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#7ec8e3" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                    Amp Máximo
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#d4a017" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                    Amp Ideal
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#b0bac8" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                    Amp de Vacío
                  </span>
                </div>
              </div>
              <AmperageChart data={chartData} ampMax={ampMaximo} ampIdeal={ampIdeal} ampVacio={ampVacio} />
            </div>

            {/* Gantt */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-[#2d3f52]">Turbinas: Tiempo Granallado Efectivo</p>
              <GanttChart data={chartData} />
            </div>

            {/* Tabla + barra */}
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="overflow-hidden rounded border border-[#dde3ec] text-[10px]">
                <div className="grid grid-cols-2 divide-x divide-[#dde3ec]">

                  {/* Consumo eléctrico */}
                  <div>
                    <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[10px] font-bold text-[#1a5fa8]">
                      Consumo Eléctrico
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                          <th className="px-2 py-1 text-left font-semibold text-[#8898a8]">Turbina</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">kWh Total</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">LOAD</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">NOLOAD</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">kWh/hr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.turbs.map((t) => (
                          <tr key={t.key} className="border-b border-[#dde3ec]">
                            <td className="px-2 py-1.5">
                              <span className="mr-1.5 inline-block h-2 w-2.5 rounded-sm" style={{ background: t.color }} />
                              {t.key}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-[#2d3f52]">{t.kwh}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[#2d3f52]">{t.kwhLoad}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{t.kwhUnload}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[#1a7a50] font-semibold">{t.kwhPerHr}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-bold text-[#2d3f52]">{maquinaNombre || "Total"}</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#2d3f52]">{chartData.totalKwh}</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#2d3f52]">{chartData.totalKwhLoad}</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#566778]">{chartData.totalKwhUnload}</td>
                          <td />
                        </tr>
                        <tr className="border-t border-[#dde3ec] bg-[#f5f7fa]">
                          <td className="px-2 py-1 text-[#8898a8]">%</td>
                          <td />
                          <td className="px-2 py-1 text-right font-semibold tabular-nums text-[#1a5fa8]">{chartData.pctLoad} %</td>
                          <td className="px-2 py-1 text-right font-semibold tabular-nums text-[#566778]">{chartData.pctUnload} %</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Granallado efectivo */}
                  <div>
                    <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[10px] font-bold text-[#1a5fa8]">
                      Granallado Efectivo
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                          <th className="px-2 py-1 text-left font-semibold text-[#8898a8]">Turbina</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">horas</th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">% del día (24H)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.turbs.map((t) => (
                          <tr key={t.key} className="border-b border-[#dde3ec]">
                            <td className="px-2 py-1.5">
                              <span className="mr-1.5 inline-block h-2 w-2.5 rounded-sm" style={{ background: t.color }} />
                              {t.key}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{t.horas.toFixed(1)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{t.pctDia.toFixed(1)} %</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-semibold text-[#5a6a7a]">Promedio</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#2d3f52]">
                            {chartData.promHoras} h
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#1a5fa8] font-semibold">
                            {round1((chartData.promHoras / 24) * 100)} %
                          </td>
                        </tr>
                        <tr className="border-t border-[#dde3ec] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-semibold text-[#5a6a7a]">Total horas</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#2d3f52]" colSpan={2}>
                            {chartData.totalHoras} h
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Triple state chart */}
              <div className="w-[280px] shrink-0">
                <p className="mb-0.5 text-center text-[10px] font-bold text-[#2d3f52]">Tiempo Activo por Turbina</p>
                <p className="mb-1 text-center text-[9px] text-[#8898a8]">% del día (24H)</p>
                <TripleStateChart turbs={chartData.turbs} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#dde3ec] bg-[#f5f7fa] px-5 py-2">
            <p className="text-[9px] text-[#5a6a7a]">
              <span className="font-semibold">CONTACTO IQgineer</span>
              {" · "}Ing. Miguel Rios{" · "}cel: 811 824 3178{" · "}email: miguel.rios@dooble-inox.de
              {" · "}www.dooble-inox.de
            </p>
            <div className="rounded bg-[#2d3f52] px-3 py-1 text-[10px] font-black tracking-widest text-white">DOOBLE</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReporteGranalladoDetalle() {
  return (
    <Suspense>
      <ReporteContent />
    </Suspense>
  );
}
