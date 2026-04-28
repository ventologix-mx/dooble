"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, Suspense, useState, useRef } from "react";
import { api } from "~/trpc/react";
import type { DatoRow } from "~/server/api/routers/datos";

// ─── Color palette para dispositivos (Gantt) ─────────────────────────────────
const PALETTE = [
  "#1e6abf",
  "#00a87c",
  "#8a7200",
  "#9b27af",
  "#d4600a",
  "#0e7a8f",
  "#2e8b57",
  "#d63030",
];

// ─── Colores por fase — A=azules, B=rojos/naranjas, C=verdes (hasta 4 dispositivos) ──
const PHASE_COLORS: Record<"A" | "B" | "C", string[]> = {
  A: ["#1e6abf", "#0369a1", "#4338ca", "#7c3aed"],
  B: ["#dc2626", "#ea580c", "#c2410c", "#b45309"],
  C: ["#059669", "#16a34a", "#0d9488", "#4d7c0f"],
};

// ─── Chart geometry ───────────────────────────────────────────────────────────
const CW = 920;
const CH = 224;
const ML = 38,
  MR = 12,
  MT = 14,
  MB = 30;
const PW = CW - ML - MR;
const PH = CH - MT - MB;

const GML = 38,
  GMR = 12,
  GMT = 8,
  GMB = 28;
const GPW = CW - GML - GMR;
const ROW_H = 26,
  ROW_GAP = 8;

const BW = 280,
  BH = 178;
const BML = 10,
  BMR = 10,
  BMT = 18,
  BMB = 56;
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
type Series = {
  key: string;
  deviceKey: string;
  color: string;
  phase: "A" | "B" | "C";
  isPrimary: boolean;
  pts: { t: number; v: number }[];
};
type Seg = { start: number; end: number; estado: "LOAD" | "NOLOAD" };
type Turb = {
  key: string;
  color: string;
  kwh: number;
  kwhLoad: number;
  kwhNoload: number;
  kwhPerHr: number;
  horasLoad: number;
  horasNoload: number;
  pctLoad: number;
  pctNoload: number;
};

type DeviceSpecs = { ampMax: number; ampIdeal: number; loadNoload: number };

type ChartData = {
  series: Series[];
  segments: Record<string, Seg[]>;
  colors: Record<string, string>;
  turbs: Turb[];
  totalKwh: number;
  totalKwhLoad: number;
  totalKwhNoload: number;
  pctLoad: number;
  pctNoload: number;
  totalHorasLoad: number;
  totalHorasNoload: number;
  promHorasLoad: number;
  avgAmpMedio: number;
  tStart: number;
  tTotal: number;
  majorTicks: { offset: number; label: string }[];
  minorTicks: { offset: number }[];
  yMax: number;
  cliente: string;
  maquina: string;
  deviceSpecs: DeviceSpecs;
};

// ─── Procesamiento de datos crudos ────────────────────────────────────────────
function processData(rows: DatoRow[]): ChartData {
  const byDevice = new Map<string, DatoRow[]>();
  for (const row of rows) {
    const key = row.dispositivo;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key)!.push(row);
  }

  // Specs del dispositivo — tomamos el primer dispositivo (todos deben coincidir)
  const firstRow = rows[0];
  const deviceSpecs: DeviceSpecs = {
    ampMax: firstRow?.amp_max ?? 24,
    ampIdeal: firstRow?.amp_ideal ?? 20,
    loadNoload: firstRow?.load_noload ?? 5,
  };

  const deviceKeys = [...byDevice.keys()].sort();
  const colors: Record<string, string> = {};
  deviceKeys.forEach((k, i) => {
    colors[k] = PALETTE[i % PALETTE.length]!;
  });

  const allTimes = rows.map((r) => minsFromMidnight(r.time));
  const rawTMin = allTimes.length ? Math.min(...allTimes) : 0;
  const rawTMax = allTimes.length ? Math.max(...allTimes) : 1440;
  const tStart = Math.max(0, Math.floor(rawTMin / 60) * 60 - 60);
  const tEnd = Math.min(1440, Math.ceil(rawTMax / 60) * 60 + 60);
  const tTotal = Math.max(tEnd - tStart, 120);

  const majorTicks: { offset: number; label: string }[] = [];
  const minorTicks: { offset: number }[] = [];
  for (let t = 0; t <= tTotal; t += 30) {
    const abs = tStart + t;
    if (t % 60 === 0) majorTicks.push({ offset: t, label: formatHHMM(abs) });
    else minorTicks.push({ offset: t });
  }

  // Genera 3 series por dispositivo: A1/B1/C1, A2/B2/C2...
  // Cada fase tiene su familia de color (A=azul, B=rojo, C=verde)
  // La línea configurada (dis.linea) se muestra ligeramente más gruesa
  const series: Series[] = deviceKeys.flatMap((key, devIdx) => {
    const devRows = byDevice.get(key)!;
    const lineaConf = (devRows[0]?.linea?.toUpperCase() ?? null) as
      | "A"
      | "B"
      | "C"
      | null;
    const colorIdx = devIdx % 4;
    return (["A", "B", "C"] as const).map((phase) => {
      const isPrimary = lineaConf === null || lineaConf === phase;
      const seriesColor = PHASE_COLORS[phase][colorIdx]!;
      const label = `${phase}${devIdx + 1}`;
      const pts = devRows.map((r) => ({
        t: minsFromMidnight(r.time) - tStart,
        v:
          phase === "A"
            ? (r.ia ?? 0)
            : phase === "B"
              ? (r.ib ?? 0)
              : (r.ic ?? 0),
      }));
      return {
        key: label,
        deviceKey: key,
        color: seriesColor,
        phase,
        isPrimary,
        pts,
      };
    });
  });

  // yMax basado en las 3 fases reales
  const allAmps = series.flatMap((s) => s.pts.map((p) => p.v));
  const yMax = Math.max(24, Math.ceil((Math.max(...allAmps, 0) + 2) / 4) * 4);

  // Segmentos Gantt con 3 estados: LOAD (verde), NOLOAD (ámbar), fondo = OFF
  const segments: Record<string, Seg[]> = {};
  for (const [key, devRows] of byDevice) {
    const segs: Seg[] = [];
    let segStart: number | null = null;
    let segEstado: "LOAD" | "NOLOAD" | null = null;
    let prevT = 0;
    for (const row of devRows) {
      const t = minsFromMidnight(row.time) - tStart;
      const est = row.estado;
      if (est === "OFF") {
        if (segStart !== null && segEstado !== null) {
          segs.push({ start: segStart, end: prevT, estado: segEstado });
          segStart = null;
          segEstado = null;
        }
      } else {
        if (segStart === null) {
          segStart = t;
          segEstado = est;
        } else if (est !== segEstado) {
          segs.push({ start: segStart, end: t, estado: segEstado! });
          segStart = t;
          segEstado = est;
        }
      }
      prevT = t;
    }
    if (segStart !== null && segEstado !== null)
      segs.push({ start: segStart, end: prevT, estado: segEstado });
    segments[key] = segs;
  }

  let sumAmp = 0,
    countAmp = 0;
  const turbs: Turb[] = deviceKeys.map((key) => {
    const devRows = byDevice.get(key)!;
    let msLoad = 0,
      msNoload = 0;
    let kwhLoad = 0,
      kwhNoload = 0,
      kwhOff = 0;
    for (let i = 0; i < devRows.length - 1; i++) {
      const r1 = devRows[i]!,
        r2 = devRows[i + 1]!;
      const dtH = (r2.time.getTime() - r1.time.getTime()) / 3_600_000;
      const dt = r2.time.getTime() - r1.time.getTime();
      const ia = ((r1.ia ?? 0) + (r2.ia ?? 0)) / 2;
      const ib = ((r1.ib ?? 0) + (r2.ib ?? 0)) / 2;
      const ic = ((r1.ic ?? 0) + (r2.ic ?? 0)) / 2;
      const ua = ((r1.ua ?? 0) + (r2.ua ?? 0)) / 2;
      const ub = ((r1.ub ?? 0) + (r2.ub ?? 0)) / 2;
      const uc = ((r1.uc ?? 0) + (r2.uc ?? 0)) / 2;
      const kwh = ((ua * ia + ub * ib + uc * ic) / 1000) * dtH;
      // Usa el estado del primer punto del intervalo
      if (r1.estado === "LOAD") {
        kwhLoad += kwh;
        msLoad += dt;
      } else if (r1.estado === "NOLOAD") {
        kwhNoload += kwh;
        msNoload += dt;
      } else {
        kwhOff += kwh;
      }
    }
    devRows.forEach((r) => {
      sumAmp += r.corriente ?? 0;
      countAmp++;
    });
    const horasLoad = msLoad / 3_600_000;
    const horasNoload = msNoload / 3_600_000;
    const totalKwhTurb = round1(kwhLoad + kwhNoload + kwhOff);
    const kwhLoadR = round1(kwhLoad);
    const kwhNoloadR = round1(kwhNoload);
    const kwhPerHr = horasLoad > 0 ? round1(kwhLoadR / horasLoad) : 0;
    return {
      key,
      color: colors[key]!,
      kwh: totalKwhTurb,
      kwhLoad: kwhLoadR,
      kwhNoload: kwhNoloadR,
      kwhPerHr,
      horasLoad: round1(horasLoad),
      horasNoload: round1(horasNoload),
      pctLoad: round1((horasLoad / 24) * 100),
      pctNoload: round1((horasNoload / 24) * 100),
    };
  });

  const totalHorasLoad = round1(turbs.reduce((s, t) => s + t.horasLoad, 0));
  const totalHorasNoload = round1(turbs.reduce((s, t) => s + t.horasNoload, 0));
  const totalKwh = round1(turbs.reduce((s, t) => s + t.kwh, 0));
  const totalKwhLoad = round1(turbs.reduce((s, t) => s + t.kwhLoad, 0));
  const totalKwhNoload = round1(turbs.reduce((s, t) => s + t.kwhNoload, 0));
  const pctLoad = totalKwh > 0 ? round1((totalKwhLoad / totalKwh) * 100) : 0;
  const pctNoload =
    totalKwh > 0 ? round1((totalKwhNoload / totalKwh) * 100) : 0;
  const avgAmpMedio = countAmp > 0 ? round1(sumAmp / countAmp) : 0;

  return {
    series,
    segments,
    colors,
    turbs,
    totalKwh,
    totalKwhLoad,
    totalKwhNoload,
    pctLoad,
    pctNoload,
    totalHorasLoad,
    totalHorasNoload,
    promHorasLoad: turbs.length > 0 ? round1(totalHorasLoad / turbs.length) : 0,
    avgAmpMedio,
    tStart,
    tTotal,
    majorTicks,
    minorTicks,
    yMax,
    cliente: rows[0]?.cliente ?? "",
    maquina: rows[0]?.maquina ?? "",
    deviceSpecs,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Sub-componentes de chart ─────────────────────────────────────────────────

function computeDynamicTicks(
  viewStart: number,
  viewEnd: number,
  tStart: number,
): {
  major: { offset: number; label: string }[];
  minor: { offset: number }[];
} {
  const span = viewEnd - viewStart;
  let majorStep: number, minorStep: number;
  if (span > 360) { majorStep = 60; minorStep = 30; }
  else if (span > 180) { majorStep = 30; minorStep = 15; }
  else if (span > 90) { majorStep = 20; minorStep = 10; }
  else if (span > 45) { majorStep = 15; minorStep = 5; }
  else if (span > 20) { majorStep = 10; minorStep = 5; }
  else if (span > 10) { majorStep = 5; minorStep = 1; }
  else { majorStep = 2; minorStep = 1; }

  const absStart = tStart + viewStart;
  const absEnd = tStart + viewEnd;
  const major: { offset: number; label: string }[] = [];
  const minor: { offset: number }[] = [];

  const fm = Math.ceil(absStart / majorStep) * majorStep;
  for (let a = fm; a <= absEnd + 0.1; a += majorStep)
    major.push({ offset: a - tStart, label: formatHHMM(a) });

  const fn = Math.ceil(absStart / minorStep) * minorStep;
  for (let a = fn; a <= absEnd + 0.1; a += minorStep)
    if (a % majorStep !== 0) minor.push({ offset: a - tStart });

  return { major, minor };
}

function AmperageSection({
  data,
  ampMax,
  ampIdeal,
  ampVacio,
}: {
  data: ChartData;
  ampMax: number;
  ampIdeal: number;
  ampVacio: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [view, setView] = useState<[number, number]>([0, data.tTotal]);
  const [dragging, setDragging] = useState<{
    startX: number;
    startView: [number, number];
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const viewSpan = view[1] - view[0];
  const isZoomed = view[0] !== 0 || view[1] !== data.tTotal;

  const { yMax, tStart } = data;
  const { major: visibleMajor, minor: visibleMinor } = computeDynamicTicks(
    view[0],
    view[1],
    tStart,
  );
  const Y_TICKS = Array.from(
    { length: Math.floor(yMax / 4) + 1 },
    (_, i) => i * 4,
  );

  function xp(t: number) {
    return ML + ((t - view[0]) / viewSpan) * PW;
  }
  function yp(v: number) {
    return MT + PH - (v / yMax) * PH;
  }
  function toPath(pts: { t: number; v: number }[]) {
    return pts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xp(p.t).toFixed(1)},${yp(p.v).toFixed(1)}`,
      )
      .join(" ");
  }

  function clampView(start: number, end: number): [number, number] {
    const span = end - start;
    let s = start, e = end;
    if (s < 0) { e -= s; s = 0; }
    if (e > data.tTotal) { s -= e - data.tTotal; e = data.tTotal; }
    s = Math.max(0, s);
    e = Math.min(data.tTotal, Math.max(s + span, s + 10));
    return [s, e];
  }

  function getSvgT(clientX: number): number {
    if (!svgRef.current) return view[0];
    const rect = svgRef.current.getBoundingClientRect();
    const frac =
      (clientX - rect.left - (ML / CW) * rect.width) /
      ((PW / CW) * rect.width);
    return view[0] + frac * viewSpan;
  }

  function zoomAround(centerT: number, factor: number) {
    const newSpan = Math.min(data.tTotal, Math.max(10, viewSpan * factor));
    const ratio = viewSpan > 0 ? (centerT - view[0]) / viewSpan : 0.5;
    setView(clampView(centerT - ratio * newSpan, centerT - ratio * newSpan + newSpan));
  }

  function zoomIn() {
    zoomAround((view[0] + view[1]) / 2, 1 / 1.6);
  }
  function zoomOut() {
    zoomAround((view[0] + view[1]) / 2, 1.6);
  }

  function handleWheel(ev: React.WheelEvent<SVGSVGElement>) {
    ev.preventDefault();
    zoomAround(getSvgT(ev.clientX), ev.deltaY > 0 ? 1.4 : 1 / 1.4);
  }

  function handleMouseDown(ev: React.MouseEvent<SVGSVGElement>) {
    if (ev.button !== 0) return;
    setDragging({ startX: ev.clientX, startView: [view[0], view[1]] });
    ev.preventDefault();
  }

  function handleMouseMove(ev: React.MouseEvent<SVGSVGElement>) {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pxPerMin = ((PW / CW) * rect.width) / viewSpan;
    const delta = -(ev.clientX - dragging.startX) / pxPerMin;
    setView(
      clampView(dragging.startView[0] + delta, dragging.startView[1] + delta),
    );
  }

  function handleMouseUp() {
    setDragging(null);
  }

  const visibleSeries = data.series.filter((s) => !hidden.has(s.key));

  return (
    <div>
      {/* Title + legend */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#2d3f52]">
            Turbinas: Variación de Amperajes
          </span>
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={zoomIn}
              title="Acercar"
              className="flex h-6 w-6 items-center justify-center rounded border border-[#dde3ec] bg-white text-[14px] font-bold text-[#566778] hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              title="Alejar"
              className="flex h-6 w-6 items-center justify-center rounded border border-[#dde3ec] bg-white text-[14px] font-bold text-[#566778] hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
            >
              −
            </button>
            {isZoomed && (
              <button
                onClick={() => setView([0, data.tTotal])}
                className="rounded border border-[#dde3ec] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#566778] hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
              >
                ↺ Reset
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5a6a7a]">
          {data.series.map((s) => (
            <button
              key={s.key}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.key)) next.delete(s.key);
                  else next.add(s.key);
                  return next;
                })
              }
              title={hidden.has(s.key) ? `Mostrar ${s.key}` : `Ocultar ${s.key}`}
              className={`flex items-center gap-1 rounded px-1 py-0.5 transition-opacity hover:bg-[#eef1f6] ${hidden.has(s.key) ? "opacity-30" : ""}`}
            >
              <svg width="22" height="10">
                <line
                  x1="0" y1="5" x2="22" y2="5"
                  stroke={s.color}
                  strokeWidth={s.isPrimary ? 2 : 1.5}
                />
              </svg>
              <span className={s.isPrimary ? "font-bold" : ""}>{s.key}</span>
            </button>
          ))}
          <span className="mx-1 text-[#dde3ec]">|</span>
          <span className="flex items-center gap-1">
            <svg width="20" height="10">
              <line x1="0" y1="5" x2="20" y2="5" stroke="#7ec8e3" strokeWidth="1.5" strokeDasharray="4,2" />
            </svg>
            Amp Máx
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="10">
              <line x1="0" y1="5" x2="20" y2="5" stroke="#d4a017" strokeWidth="1.5" strokeDasharray="4,2" />
            </svg>
            Ideal
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="10">
              <line x1="0" y1="5" x2="20" y2="5" stroke="#b0bac8" strokeWidth="1.5" strokeDasharray="4,2" />
            </svg>
            Vacío
          </span>
          <span className="ml-1 text-[10px] text-[#aab4c0] print:hidden">
            rueda=zoom · arrastrar=pan
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CW} ${CH}`}
          className="w-full"
          style={{ cursor: dragging ? "grabbing" : isZoomed ? "grab" : "default" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <clipPath id="amp-plot">
              <rect x={ML} y={MT} width={PW} height={PH} />
            </clipPath>
          </defs>

          {Y_TICKS.map((y) => (
            <line key={y} x1={ML} y1={yp(y)} x2={CW - MR} y2={yp(y)}
              stroke={y === 0 ? "#9aa8b8" : "#dde3ec"}
              strokeWidth={y === 0 ? 0.8 : 0.6}
              strokeDasharray={y > 0 ? "3,3" : undefined}
            />
          ))}
          {visibleMajor.map(({ offset }) => (
            <line key={offset} x1={xp(offset)} y1={MT} x2={xp(offset)} y2={CH - MB}
              stroke="#dde3ec" strokeWidth={0.6} strokeDasharray="3,3"
            />
          ))}
          {visibleMinor.map(({ offset }) => (
            <line key={offset} x1={xp(offset)} y1={MT} x2={xp(offset)} y2={CH - MB}
              stroke="#eef1f6" strokeWidth={0.5}
            />
          ))}
          <line x1={ML} y1={yp(ampMax)} x2={CW - MR} y2={yp(ampMax)} stroke="#7ec8e3" strokeWidth={1} strokeDasharray="6,3" />
          <line x1={ML} y1={yp(ampIdeal)} x2={CW - MR} y2={yp(ampIdeal)} stroke="#d4a017" strokeWidth={1} strokeDasharray="6,3" />
          <line x1={ML} y1={yp(ampVacio)} x2={CW - MR} y2={yp(ampVacio)} stroke="#b0bac8" strokeWidth={1} strokeDasharray="6,3" />

          <g clipPath="url(#amp-plot)">
            {visibleSeries.map((s) => (
              <path key={s.key} d={toPath(s.pts)} fill="none"
                stroke={s.color}
                strokeWidth={s.isPrimary ? 1.8 : 1.2}
                strokeLinejoin="round" strokeLinecap="round"
              />
            ))}
          </g>

          {Y_TICKS.map((y) => (
            <text key={y} x={ML - 4} y={yp(y) + 3.5} textAnchor="end" fontSize={7.5} fill="#8898a8">
              {y}A
            </text>
          ))}
          {visibleMajor.map(({ offset, label }) => (
            <text key={offset} x={xp(offset)} y={CH - MB + 12} textAnchor="middle" fontSize={7.5} fill="#8898a8">
              {label}
            </text>
          ))}
          <line x1={ML} y1={MT} x2={ML} y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
          <line x1={CW - MR} y1={MT} x2={CW - MR} y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
          <line x1={ML} y1={CH - MB} x2={CW - MR} y2={CH - MB} stroke="#b0bac8" strokeWidth={0.8} />
          <line x1={ML} y1={MT} x2={CW - MR} y2={MT} stroke="#b0bac8" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Scrollbar — visible only when zoomed */}
      {isZoomed && (
        <div className="mt-1 flex items-center gap-2 print:hidden">
          <span className="shrink-0 text-[10px] text-[#8898a8]">
            {formatHHMM(tStart + view[0])}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, data.tTotal - viewSpan)}
            step={0.5}
            value={view[0]}
            onChange={(e) => {
              const s = Number(e.target.value);
              setView([s, s + viewSpan]);
            }}
            className="h-2 w-full cursor-pointer accent-[#1a5fa8]"
          />
          <span className="shrink-0 text-[10px] text-[#8898a8]">
            {formatHHMM(tStart + view[1])}
          </span>
        </div>
      )}
    </div>
  );
}

function GanttChart({ data }: { data: ChartData }) {
  const { segments, colors, majorTicks, minorTicks, tTotal } = data;
  const rowKeys = Object.keys(segments).sort().reverse();
  const GH = GMT + rowKeys.length * (ROW_H + ROW_GAP) - ROW_GAP + GMB;

  function gx(t: number) {
    return GML + (t / tTotal) * GPW;
  }

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${CW} ${GH}`} className="w-full">
        {majorTicks.map(({ offset }) => (
          <line
            key={offset}
            x1={gx(offset)}
            y1={GMT}
            x2={gx(offset)}
            y2={GH - GMB}
            stroke="#dde3ec"
            strokeWidth={0.6}
            strokeDasharray="3,3"
          />
        ))}
        {minorTicks.map(({ offset }) => (
          <line
            key={offset}
            x1={gx(offset)}
            y1={GMT}
            x2={gx(offset)}
            y2={GH - GMB}
            stroke="#eef1f6"
            strokeWidth={0.5}
          />
        ))}
        {rowKeys.map((key, rowIdx) => {
          const y = GMT + rowIdx * (ROW_H + ROW_GAP);
          const color = colors[key]!;
          const segs = segments[key] ?? [];
          return (
            <g key={key}>
              <rect
                x={GML}
                y={y}
                width={GPW}
                height={ROW_H}
                fill="#eff2f7"
                rx={2}
              />
              {segs.map((seg, i) => (
                <rect
                  key={i}
                  x={gx(seg.start)}
                  y={y}
                  width={Math.max(1, gx(seg.end) - gx(seg.start))}
                  height={ROW_H}
                  fill={seg.estado === "LOAD" ? color : "#f5a623"}
                  opacity={seg.estado === "NOLOAD" ? 0.7 : 1}
                  rx={1}
                />
              ))}
              <text
                x={GML - 5}
                y={y + ROW_H / 2 + 3.5}
                textAnchor="end"
                fontSize={8}
                fontWeight="700"
                fill="#3d4f63"
              >
                {key}
              </text>
            </g>
          );
        })}
        {majorTicks.map(({ offset, label }) => (
          <text
            key={offset}
            x={gx(offset)}
            y={GH - GMB + 12}
            textAnchor="middle"
            fontSize={7.5}
            fill="#8898a8"
          >
            {label}
          </text>
        ))}
        <line
          x1={GML}
          y1={GH - GMB}
          x2={CW - GMR}
          y2={GH - GMB}
          stroke="#b0bac8"
          strokeWidth={0.8}
        />
      </svg>
    </div>
  );
}

function PctBarChart({ turbs }: { turbs: Turb[] }) {
  const barW = Math.max(
    8,
    Math.floor((BPW - (turbs.length - 1) * 14) / turbs.length),
  );
  const spacing = barW + 14;
  const startX =
    BML + (BPW - (turbs.length * barW + (turbs.length - 1) * 14)) / 2;

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = BMT + BPH - (v / 100) * BPH;
          return (
            <line
              key={v}
              x1={BML}
              y1={y}
              x2={BW - BMR}
              y2={y}
              stroke="#dde3ec"
              strokeWidth={0.6}
              strokeDasharray="2,3"
            />
          );
        })}
        {turbs.map((t, i) => {
          const x = startX + i * spacing;
          const bhLoad = (t.pctLoad / 100) * BPH;
          const bhNoload = (t.pctNoload / 100) * BPH;
          const yLoad = BMT + BPH - bhLoad;
          const yNoload = yLoad - bhNoload;
          const totalPct = round1(t.pctLoad + t.pctNoload);
          const labelY = (bhNoload > 0 ? yNoload : yLoad) - 4;
          return (
            <g key={t.key}>
              {bhNoload > 0 && (
                <rect
                  x={x}
                  y={yNoload}
                  width={barW}
                  height={bhNoload}
                  fill="#f5a623"
                  opacity={0.8}
                  rx={0}
                />
              )}
              {bhLoad > 0 && (
                <rect
                  x={x}
                  y={yLoad}
                  width={barW}
                  height={bhLoad}
                  fill={t.color}
                  rx={0}
                />
              )}
              {totalPct > 0 && (
                <text
                  x={x + barW / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight="700"
                  fill="#3d4f63"
                >
                  {totalPct}%
                </text>
              )}
              <text
                x={x + barW / 2}
                y={BMT + BPH + 13}
                textAnchor="middle"
                fontSize={7}
                fill="#3d4f63"
              >
                {t.key.length > 8 ? t.key.slice(0, 8) + "…" : t.key}
              </text>
            </g>
          );
        })}
        <line
          x1={BML}
          y1={BMT + BPH}
          x2={BW - BMR}
          y2={BMT + BPH}
          stroke="#9aa8b8"
          strokeWidth={0.8}
        />
        {/* Leyenda */}
        <rect x={BML} y={BMT + BPH + 22} width={9} height={7} fill="#1e6abf" />
        <text x={BML + 12} y={BMT + BPH + 29} fontSize={7} fill="#3d4f63">
          LOAD
        </text>
        <rect
          x={BML + 42}
          y={BMT + BPH + 22}
          width={9}
          height={7}
          fill="#f5a623"
          opacity={0.8}
        />
        <text x={BML + 54} y={BMT + BPH + 29} fontSize={7} fill="#3d4f63">
          NOLOAD
        </text>
      </svg>
    </div>
  );
}

function MaqRow({
  label,
  value,
  extra,
  extraVal,
  unit,
  highlight = false,
}: {
  label: string;
  value: string | number;
  extra: string;
  extraVal: string | number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <tr className="border-b border-[#dde3ec]">
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[12px] font-semibold text-[#5a6a7a]">
        {label}
      </td>
      <td className="border-r border-[#dde3ec] px-2 py-[5px] text-[12px] text-[#2d3f52]">
        {value}
      </td>
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[12px] font-semibold text-[#5a6a7a]">
        {extra}
      </td>
      <td
        className={`border-r border-[#dde3ec] px-2 py-[5px] text-right text-[12px] font-bold ${highlight ? "text-[#1a5fa8]" : "text-[#2d3f52]"}`}
      >
        {extraVal}
      </td>
      <td className="px-2 py-[5px] text-[12px] text-[#8898a8]">{unit}</td>
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
  const fechaParam =
    searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  const { data: maquinasIoT, isLoading: loadingMaq } =
    api.datos.getMaquinasConDatos.useQuery(
      { id_cliente: numClienteId },
      { enabled: numClienteId > 0 },
    );

  // true cuando el cliente existe pero no tiene dispositivos vinculados a máquinas
  const sinMaquina = !loadingMaq && (maquinasIoT?.length ?? 0) === 0;

  const selectedMaquinaId = maquinaParam
    ? parseInt(maquinaParam, 10)
    : (maquinasIoT?.[0]?.id_maquina ?? null);

  // Specs de la máquina — solo para campos no eléctricos (HP, turbinas, voltaje)
  const { data: maquinasSpecs } = api.maquinas.listByCliente.useQuery(
    { id_cliente: numClienteId },
    { enabled: numClienteId > 0 },
  );
  const specs = maquinasSpecs?.find((m) => m.id_maquina === selectedMaquinaId);

  // Query normal (con máquina)
  const { data: rawRows, isLoading: loadingDatos } =
    api.datos.getDatosMaquinaFecha.useQuery(
      {
        id_cliente: numClienteId,
        id_maquina: selectedMaquinaId ?? 0,
        fecha: fechaParam,
      },
      { enabled: numClienteId > 0 && selectedMaquinaId != null },
    );

  // Query fallback (sin máquina vinculada)
  const { data: rawRowsCliente, isLoading: loadingDatosCliente } =
    api.datos.getDatosClienteFecha.useQuery(
      { id_cliente: numClienteId, fecha: fechaParam },
      { enabled: numClienteId > 0 && sinMaquina },
    );

  const { data: summaryDia } = api.datos.getSummaryDia.useQuery(
    {
      id_cliente: numClienteId,
      id_maquina: selectedMaquinaId ?? 0,
      fecha: fechaParam,
    },
    { enabled: numClienteId > 0 && (selectedMaquinaId != null || sinMaquina) },
  );

  const { data: resumen30d } = api.datos.getResumen30Dias.useQuery(
    {
      id_cliente: numClienteId,
      id_maquina: selectedMaquinaId ?? 0,
      fecha: fechaParam,
    },
    { enabled: numClienteId > 0 && selectedMaquinaId != null },
  );

  const efectiveRows = rawRows ?? rawRowsCliente;

  const chartData = useMemo(() => {
    if (!efectiveRows?.length) return null;
    return processData(efectiveRows);
  }, [efectiveRows]);

  const summaryByDevice = useMemo(() => {
    if (!summaryDia?.length) return null;
    return new Map(summaryDia.map((s) => [s.dispositivo, s]));
  }, [summaryDia]);

  const summaryGlobal = useMemo(() => {
    if (!summaryDia?.length) return null;
    const inits = summaryDia.map((s) => s.inicio_func).filter((d): d is Date => d != null);
    const fins  = summaryDia.map((s) => s.fin_func).filter((d): d is Date => d != null);
    return {
      inicio_func: inits.length ? new Date(Math.min(...inits.map((d) => d.getTime()))) : null,
      fin_func:    fins.length  ? new Date(Math.max(...fins.map((d)  => d.getTime()))) : null,
      kwh_total_general: round2(summaryDia.reduce((acc, s) => acc + s.kwh_total_general, 0)),
      kwh_load:  round2(summaryDia.reduce((acc, s) => acc + s.kwh_load_a  + s.kwh_load_b  + s.kwh_load_c,  0)),
      kwh_noload: round2(summaryDia.reduce((acc, s) => acc + s.kwh_noload_a + s.kwh_noload_b + s.kwh_noload_c, 0)),
    };
  }, [summaryDia]);

  // Valores eléctricos desde el dispositivo (via chartData) — fallback a specs de máquina
  const ampVacio = chartData?.deviceSpecs.loadNoload ?? specs?.amp_vacio ?? 5;
  const ampMaximo = chartData?.deviceSpecs.ampMax ?? specs?.amp_maximo ?? 24;
  const ampIdeal =
    chartData?.deviceSpecs.ampIdeal ??
    (ampMaximo > 0 ? Math.round(ampMaximo * 0.85) : 20);

  function navigate(maquinaId: number, fecha: string) {
    void router.push(
      `/reporte-diario/${clienteId}?maquina=${maquinaId}&fecha=${fecha}`,
    );
  }

  const isLoading = loadingMaq || loadingDatos || loadingDatosCliente;
  const clienteNombre =
    chartData?.cliente ??
    maquinasIoT?.[0]?.maquina ??
    rawRowsCliente?.[0]?.cliente ??
    `Cliente ${clienteId}`;
  const maquinaNombre =
    chartData?.maquina ??
    maquinasIoT?.find((m) => m.id_maquina === selectedMaquinaId)?.maquina ??
    "";
  const fechaDisplay = new Date(fechaParam + "T12:00:00").toLocaleDateString(
    "es-MX",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );

  return (
    <div className="min-h-screen bg-[#eef1f6] py-6 print:bg-white print:py-0">
      {/* Breadcrumb + controles */}
      <div className="mx-auto mb-4 flex max-w-[1120px] flex-wrap items-center gap-2 px-4 text-[14px] text-[#8898a8] print:hidden">
        <Link href="/home" className="hover:text-[#1a5fa8]">
          Inicio
        </Link>
        <span>/</span>
        <Link href="/reporte-diario" className="hover:text-[#1a5fa8]">
          Reporte Granallado
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#3d4f63]">
          {clienteNombre || `Cliente ${clienteId}`}
        </span>
        <div className="flex-1" />

        {maquinasIoT && maquinasIoT.length > 1 && (
          <select
            value={selectedMaquinaId ?? ""}
            onChange={(e) => navigate(Number(e.target.value), fechaParam)}
            className="rounded border border-[#dde3ec] bg-white px-2 py-1 text-[13px] text-[#3d4f63] focus:border-[#1a5fa8] focus:outline-none"
          >
            {maquinasIoT.map((m) => (
              <option key={m.id_maquina} value={m.id_maquina}>
                {m.maquina}
              </option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={fechaParam}
          onChange={(e) => {
            if (sinMaquina)
              void router.push(
                `/reporte-diario/${clienteId}?fecha=${e.target.value}`,
              );
            else if (selectedMaquinaId)
              navigate(selectedMaquinaId, e.target.value);
          }}
          className="rounded border border-[#dde3ec] bg-white px-2 py-1 text-[13px] text-[#3d4f63] focus:border-[#1a5fa8] focus:outline-none"
        />

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded border border-[#dde3ec] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Imprimir
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mx-auto flex max-w-[1120px] items-center justify-center px-4 py-24">
          <div className="flex flex-col items-center gap-3 text-[#8898a8]">
            <svg
              className="h-8 w-8 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-base font-semibold">Cargando datos…</span>
          </div>
        </div>
      )}

      {/* Sin datos para la fecha */}
      {!isLoading && (selectedMaquinaId ?? sinMaquina) && !chartData && (
        <div className="mx-4 flex max-w-[1120px] flex-col items-center justify-center rounded-xl border border-dashed border-[#dde3ec] bg-white py-24 text-center sm:mx-auto">
          <svg
            className="mb-3 h-10 w-10 text-[#aab4c0]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-base font-semibold text-[#8898a8]">
            Sin datos de telemetría para el {fechaDisplay}
          </p>
          <p className="mt-1 text-sm text-[#aab4c0]">
            Selecciona otra fecha o verifica la conexión del dispositivo.
          </p>
        </div>
      )}

      {/* ── Reporte ───────────────────────────────────────────────────────────── */}
      {!isLoading && chartData && (
        <div className="mx-auto max-w-[1120px] overflow-hidden rounded-xl bg-white shadow-lg print:rounded-none print:shadow-none">
          {/* Header */}
          <div className="flex items-stretch border-b-2 border-[#dde3ec]">
            <div className="flex flex-1 items-center justify-center px-4 py-2.5">
              <h1 className="text-center text-[15px] font-extrabold tracking-wide text-[#2d3f52] uppercase">
                REPORTE GRANALLADO DIARIO &nbsp;·&nbsp; {maquinaNombre}
              </h1>
            </div>
          </div>

          {/* Cliente + Fecha */}
          <div className="flex items-center justify-between border-b border-[#dde3ec] bg-[#f0f4f8] px-5 py-1.5">
            <span className="text-[17px] font-bold text-[#2d3f52]">
              {chartData.cliente}
            </span>
            <span className="text-[14px] font-semibold tracking-wide text-[#566778]">
              FECHA:&nbsp; {fechaDisplay}
            </span>
          </div>

          {/* Info + Resumen */}
          <div className="grid grid-cols-[1.35fr_1fr] divide-x divide-[#dde3ec] border-b border-[#dde3ec]">
            {/* Specs */}
            <table className="w-full">
              <tbody>
                <MaqRow
                  label="Máquina"
                  value={maquinaNombre}
                  extra="Amp Máximo"
                  extraVal={ampMaximo}
                  unit="A"
                />
                <MaqRow
                  label="Dispositivos"
                  value={chartData.series.length}
                  extra="Amp Ideal"
                  extraVal={ampIdeal}
                  unit="A"
                  highlight
                />
                <MaqRow
                  label="Voltaje"
                  value={specs ? "440" : "—"}
                  extra="Amp Vacío"
                  extraVal={ampVacio}
                  unit="A"
                />
                {specs?.potencia_hp != null && (
                  <MaqRow
                    label="Potencia HP"
                    value={specs.potencia_hp}
                    extra="Turbinas"
                    extraVal={specs.cantidad_turbinas ?? "—"}
                    unit=""
                  />
                )}
              </tbody>
            </table>

            {/* Resumen operación */}
            <div className="flex flex-col">
              <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1.5 text-center text-[12px] font-bold tracking-wider text-[#1a5fa8] uppercase">
                Resumen de Operación
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                    <th className="px-3 py-1 text-left font-semibold text-[#8898a8]"></th>
                    <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">
                      Valores del día
                    </th>
                    <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">
                      Últ. 30 días
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Inicio Op.</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {summaryGlobal ? fmtTime(summaryGlobal.inicio_func) : "—"}
                    </td>
                    <td className="px-3 py-1 text-right text-[#566778]">—</td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Fin Op.</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {summaryGlobal ? fmtTime(summaryGlobal.fin_func) : "—"}
                    </td>
                    <td className="px-3 py-1 text-right text-[#566778]">—</td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Consumo KWh</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {summaryGlobal ? summaryGlobal.kwh_total_general : chartData.totalKwh}
                    </td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? resumen30d.total_kwh : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">Amp. Medio</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {chartData.avgAmpMedio} A
                    </td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? `${resumen30d.avg_amp} A` : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#1a9e5c]" />
                      Horas LOAD
                    </td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {chartData.totalHorasLoad} h
                    </td>
                    <td className="px-3 py-1 text-right font-semibold text-[#566778]">
                      {resumen30d ? `${resumen30d.horas_granallando} h` : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#f5a623]" />
                      Horas NOLOAD
                    </td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {chartData.totalHorasNoload} h
                    </td>
                    <td className="px-3 py-1 text-right text-[#566778]">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-4 p-4">
            {/* Amperaje */}
            <AmperageSection
              data={chartData}
              ampMax={ampMaximo}
              ampIdeal={ampIdeal}
              ampVacio={ampVacio}
            />

            {/* Gantt */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-[#2d3f52]">
                  Turbinas: Tiempo Granallado Efectivo
                </span>
                <div className="flex items-center gap-4 text-[11px] text-[#5a6a7a]">
                  {Object.entries(chartData.colors).map(([devKey, color]) => (
                    <span key={devKey} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-5 rounded-sm"
                        style={{ background: color }}
                      />
                      {devKey} LOAD
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-[#f5a623] opacity-80" />
                    NOLOAD
                  </span>
                </div>
              </div>
              <GanttChart data={chartData} />
            </div>

            {/* Tabla + barra */}
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="overflow-hidden rounded border border-[#dde3ec] text-[12px]">
                <div className="grid grid-cols-2 divide-x divide-[#dde3ec]">
                  {/* Consumo eléctrico */}
                  <div>
                    <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[12px] font-bold text-[#1a5fa8]">
                      Consumo Eléctrico
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                          <th className="px-2 py-1 text-left font-semibold text-[#8898a8]"></th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                            kWh Total
                          </th>
                          <th className="px-2 py-1 text-right font-semibold text-[#1a9e5c]">
                            LOAD
                          </th>
                          <th className="px-2 py-1 text-right font-semibold text-[#d4860a]">
                            NOLOAD
                          </th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                            kWh/hr
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.turbs.map((t) => {
                          const sp = summaryByDevice?.get(t.key);
                          const totalKwh = sp ? sp.kwh_total_general : t.kwh;
                          const loadKwh  = sp ? round2(sp.kwh_load_a  + sp.kwh_load_b  + sp.kwh_load_c)  : t.kwhLoad;
                          const noloadKwh = sp ? round2(sp.kwh_noload_a + sp.kwh_noload_b + sp.kwh_noload_c) : t.kwhNoload;
                          return (
                            <tr key={t.key} className="border-b border-[#dde3ec]">
                              <td className="px-2 py-1.5">
                                <span
                                  className="mr-1.5 inline-block h-2 w-2.5 rounded-sm"
                                  style={{ background: t.color }}
                                />
                                {t.key}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-[#2d3f52] tabular-nums">
                                {totalKwh}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-[#1a7a50] tabular-nums">
                                {loadKwh}
                              </td>
                              <td className="px-2 py-1.5 text-right text-[#d4860a] tabular-nums">
                                {noloadKwh}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-[#1a7a50] tabular-nums">
                                {t.kwhPerHr}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-bold text-[#2d3f52]">Total</td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums">
                            {summaryGlobal ? summaryGlobal.kwh_total_general : chartData.totalKwh}
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#1a7a50] tabular-nums">
                            {summaryGlobal ? summaryGlobal.kwh_load : chartData.totalKwhLoad}
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#d4860a] tabular-nums">
                            {summaryGlobal ? summaryGlobal.kwh_noload : chartData.totalKwhNoload}
                          </td>
                          <td />
                        </tr>
                        <tr className="border-t border-[#dde3ec] bg-[#f5f7fa]">
                          <td className="px-2 py-1 text-[10px] text-[#aab4c0]">
                            {summaryGlobal ? "√3·V·I·fp" : "medido"}
                          </td>
                          <td />
                          <td className="px-2 py-1 text-right font-semibold text-[#1a9e5c] tabular-nums">
                            {chartData.pctLoad} %
                          </td>
                          <td className="px-2 py-1 text-right font-semibold text-[#d4860a] tabular-nums">
                            {chartData.pctNoload} %
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Granallado efectivo */}
                  <div>
                    <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[12px] font-bold text-[#1a5fa8]">
                      Granallado Efectivo
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                          <th className="px-2 py-1 text-left font-semibold text-[#8898a8]"></th>
                          <th className="px-2 py-1 text-right font-semibold text-[#1a9e5c]">
                            LOAD h
                          </th>
                          <th className="px-2 py-1 text-right font-semibold text-[#d4860a]">
                            NOLOAD h
                          </th>
                          <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                            % activo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.turbs.map((t) => (
                          <tr key={t.key} className="border-b border-[#dde3ec]">
                            <td className="px-2 py-1.5">
                              <span
                                className="mr-1.5 inline-block h-2 w-2.5 rounded-sm"
                                style={{ background: t.color }}
                              />
                              {t.key}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold text-[#1a7a50] tabular-nums">
                              {t.horasLoad.toFixed(1)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[#d4860a] tabular-nums">
                              {t.horasNoload.toFixed(1)}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {round1(t.pctLoad + t.pctNoload).toFixed(1)} %
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-semibold text-[#5a6a7a]">
                            Promedio LOAD
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums">
                            {chartData.promHorasLoad} h
                          </td>
                          <td />
                          <td className="px-2 py-1.5 text-right font-semibold text-[#1a5fa8] tabular-nums">
                            {round1((chartData.promHorasLoad / 24) * 100)} %
                          </td>
                        </tr>
                        <tr className="border-t border-[#dde3ec] bg-[#f0f4f8]">
                          <td className="px-2 py-1.5 font-semibold text-[#5a6a7a]">
                            Total LOAD
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums">
                            {chartData.totalHorasLoad} h
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#d4860a] tabular-nums">
                            {chartData.totalHorasNoload} h
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="w-[280px] shrink-0">
                <p className="mb-0.5 text-center text-[12px] font-bold text-[#2d3f52]">
                  Tiempo Activo por Dispositivo
                </p>
                <p className="mb-1 text-center text-[11px] text-[#8898a8]">
                  % del día (24H) · LOAD + NOLOAD
                </p>
                <PctBarChart turbs={chartData.turbs} />
              </div>
            </div>

            {/* Energía por Fase */}
            {summaryDia && summaryDia.length > 0 && (
              <div className="overflow-hidden rounded border border-[#dde3ec] text-[12px]">
                <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[12px] font-bold text-[#1a5fa8]">
                  Energía por Fase &nbsp;
                  <span className="font-normal text-[#8898a8]">(√3 · V · I · fp)</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                      <th className="px-2 py-1 text-left font-semibold text-[#8898a8]">Dispositivo</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#1e6abf]">kWh A</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#7098c0]">Load A</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#7098c0]">NoLd A</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#dc2626]">kWh B</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#e07070]">Load B</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#e07070]">NoLd B</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#059669]">kWh C</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#60a07a]">Load C</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#60a07a]">NoLd C</th>
                      <th className="px-2 py-1 text-right font-bold text-[#2d3f52]">Total</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">Inicio</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">Fin</th>
                      <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">Hs Op.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryDia.map((s) => {
                      const color = chartData.colors[s.dispositivo] ?? "#1e6abf";
                      return (
                        <tr key={s.id_dispositivo} className="border-b border-[#dde3ec]">
                          <td className="px-2 py-1.5">
                            <span className="mr-1.5 inline-block h-2 w-2.5 rounded-sm" style={{ background: color }} />
                            {s.dispositivo}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#1e6abf]">{s.kwh_total_a}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_load_a}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_noload_a}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#dc2626]">{s.kwh_total_b}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_load_b}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_noload_b}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#059669]">{s.kwh_total_c}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_load_c}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.kwh_noload_c}</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#2d3f52]">{s.kwh_total_general}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{fmtTime(s.inicio_func)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{fmtTime(s.fin_func)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[#566778]">{s.horas_trabajadas} h</td>
                        </tr>
                      );
                    })}
                    {summaryDia.length > 1 && (
                      <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8] font-bold">
                        <td className="px-2 py-1.5 text-[#2d3f52]">Total</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#1e6abf]">
                          {round2(summaryDia.reduce((a, s) => a + s.kwh_total_a, 0))}
                        </td>
                        <td colSpan={2} />
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#dc2626]">
                          {round2(summaryDia.reduce((a, s) => a + s.kwh_total_b, 0))}
                        </td>
                        <td colSpan={2} />
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#059669]">
                          {round2(summaryDia.reduce((a, s) => a + s.kwh_total_c, 0))}
                        </td>
                        <td colSpan={2} />
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#2d3f52]">
                          {summaryGlobal?.kwh_total_general}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
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
