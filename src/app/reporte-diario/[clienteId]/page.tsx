"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// ─── Seeded deterministic pseudo-random (no hydration issues) ─────────────────
function sr(n: number): number {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Chart geometry ───────────────────────────────────────────────────────────
const CW = 920; // SVG viewBox width
const CH = 224; // line chart height
const ML = 38,
  MR = 12,
  MT = 14,
  MB = 30;
const PW = CW - ML - MR;
const PH = CH - MT - MB;
const T_TOTAL = 720; // 12 h × 60 min (6:00–18:00)
const Y_MAX = 24;

function xp(t: number) {
  return ML + (t / T_TOTAL) * PW;
}
function yp(v: number) {
  return MT + PH - (v / Y_MAX) * PH;
}
function toPath(pts: Array<{ t: number; v: number }>) {
  return pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xp(p.t).toFixed(1)},${yp(p.v).toFixed(1)}`,
    )
    .join(" ");
}

// Major tick every 60 min, minor tick every 30 min
const MAJOR_TICKS = Array.from({ length: 13 }, (_, i) => ({
  t: i * 60,
  label: `${String(6 + i).padStart(2, "0")}:00`,
}));
const MINOR_TICKS = Array.from({ length: 12 }, (_, i) => ({ t: 30 + i * 60 }));
const Y_TICKS = [0, 4, 8, 12, 16, 20, 24];

// ─── Gantt chart geometry ─────────────────────────────────────────────────────
const GML = 38,
  GMR = 12,
  GMT = 8,
  GMB = 28;
const GPW = CW - GML - GMR;
const ROW_H = 26,
  ROW_GAP = 8;
const GANTT_ROWS = ["T4", "T3", "T2", "T1"] as const;
const GH = GMT + GANTT_ROWS.length * (ROW_H + ROW_GAP) - ROW_GAP + GMB;
function gx(t: number) {
  return GML + (t / T_TOTAL) * GPW;
}

// ─── Bar chart geometry ───────────────────────────────────────────────────────
const BW = 280,
  BH = 150;
const BML = 10,
  BMR = 10,
  BMT = 18,
  BMB = 28;
const BPW = BW - BML - BMR;
const BPH = BH - BMT - BMB;

// ─── Turbine config ───────────────────────────────────────────────────────────
const TURBINES = [
  { key: "T1", color: "#1e6abf", base: 16.2, seed: 10 },
  { key: "T2", color: "#d63030", base: 15.8, seed: 55 },
  { key: "T3", color: "#00a87c", base: 16.5, seed: 100 },
  { key: "T4", color: "#8a7200", base: 15.5, seed: 145 },
] as const;

const TURB_COLORS: Record<string, string> = {
  T1: "#1e6abf",
  T2: "#d63030",
  T3: "#00a87c",
  T4: "#8a7200",
};

// ─── Gantt segments [start, end] in minutes from 6:00 ────────────────────────
const SEGS: Record<string, Array<[number, number]>> = {
  T1: [
    [0, 118],
    [138, 288],
    [305, 448],
    [470, 592],
    [615, 720],
  ],
  T2: [
    [28, 172],
    [198, 238],
    [262, 348],
    [392, 532],
    [558, 720],
  ],
  T3: [
    [12, 102],
    [118, 258],
    [278, 432],
    [452, 597],
    [622, 720],
  ],
  T4: [
    [18, 198],
    [228, 375],
    [393, 518],
    [542, 665],
    [685, 720],
  ],
};

function isActiveAt(key: string, t: number) {
  return SEGS[key]!.some(([s, e]) => t >= s && t <= e);
}

// ─── Pre-generate series data (deterministic) ─────────────────────────────────
function buildSeries(key: string, base: number, seed: number) {
  const pts: Array<{ t: number; v: number }> = [];
  for (let t = 0; t <= T_TOTAL; t += 4) {
    const active = isActiveAt(key, t);
    const v = active
      ? Math.max(10.5, Math.min(21.5, base + (sr(seed + t) - 0.5) * 3.4))
      : Math.max(4.0, Math.min(6.5, 5 + (sr(seed + t + 777) - 0.5) * 0.9));
    pts.push({ t, v });
  }
  return pts;
}

const ALL_SERIES = TURBINES.map((t) => ({
  ...t,
  pts: buildSeries(t.key, t.base, t.seed),
}));

// ─── Mock report data per client ──────────────────────────────────────────────
const CLIENT_DATA: Record<string, typeof BASE_REPORT> = {};

const BASE_REPORT = {
  cliente: "Frontera Aluminios",
  fecha: "15-04-2026",
  maq: {
    nombre: "Granalladora #1 Perfiles",
    codigo: "2452502",
    turbinas: 4,
    voltaje: 460,
    producto: "Perfiles de Aluminio",
    abrasivo: "IMPAKT-INOX 10",
    produccion: 65,
    ampMax: 20,
    ampIdeal: 17,
    ampVacio: 5,
    potencia: 47.5,
    precioAbr: 6.3,
    consumoAbr: 3.4,
  },
  hoy: { kwh: 916.3, ampMedio: 14.7, horometro: 18.9, granalla: 64 },
  mes: { kwh: 3468.8, ampMedio: 11.5, horometro: 86.4, granalla: 291 },
  turbs: [
    {
      id: "T1",
      color: "#1e6abf",
      kwh: 251.3,
      horas: 18.0,
      pctDia: 75.0,
      pctTotal: 26.8,
    },
    {
      id: "T2",
      color: "#d63030",
      kwh: 231.4,
      horas: 15.7,
      pctDia: 65.4,
      pctTotal: 23.4,
    },
    {
      id: "T3",
      color: "#00a87c",
      kwh: 223.7,
      horas: 17.4,
      pctDia: 72.5,
      pctTotal: 25.9,
    },
    {
      id: "T4",
      color: "#8a7200",
      kwh: 209.9,
      horas: 16.0,
      pctDia: 66.7,
      pctTotal: 23.8,
    },
  ],
  promHoras: 16.8,
  totalHoras: 67.1,
  totalKwh: 916.3,
};

CLIENT_DATA["frontera-aluminios"] = BASE_REPORT;
CLIENT_DATA["industrias-monterrey"] = {
  ...BASE_REPORT,
  cliente: "Industrias Monterrey SA",
  maq: {
    ...BASE_REPORT.maq,
    nombre: "Granalladora #2 Estructural",
    codigo: "2451890",
    turbinas: 6,
    voltaje: 480,
    producto: "Estructura Metálica",
    ampMax: 22,
    ampIdeal: 18,
    potencia: 72.0,
  },
  hoy: { kwh: 1240.8, ampMedio: 13.2, horometro: 16.4, granalla: 89 },
  mes: { kwh: 4820.1, ampMedio: 12.1, horometro: 74.2, granalla: 412 },
};
CLIENT_DATA["aceros-del-norte"] = {
  ...BASE_REPORT,
  cliente: "Aceros del Norte",
  maq: {
    ...BASE_REPORT.maq,
    nombre: "Granalladora #1 Tubería",
    codigo: "2450341",
    turbinas: 2,
    voltaje: 440,
    producto: "Tubería Estructural",
    ampMax: 18,
    ampIdeal: 14,
    potencia: 28.5,
  },
  hoy: { kwh: 384.5, ampMedio: 9.1, horometro: 11.2, granalla: 38 },
  mes: { kwh: 1560.2, ampMedio: 8.8, horometro: 52.4, granalla: 178 },
};
CLIENT_DATA.metalsa = {
  ...BASE_REPORT,
  cliente: "Metalsa Ramos Arizpe",
  maq: {
    ...BASE_REPORT.maq,
    nombre: "Granalladora #3 Chasis",
    codigo: "2449780",
    turbinas: 8,
    voltaje: 480,
    producto: "Chasis Automotriz",
    ampMax: 24,
    ampIdeal: 20,
    potencia: 120.0,
  },
  hoy: { kwh: 2180.4, ampMedio: 17.3, horometro: 22.1, granalla: 142 },
  mes: { kwh: 8640.0, ampMedio: 16.9, horometro: 98.3, granalla: 648 },
};
CLIENT_DATA.vitro = {
  ...BASE_REPORT,
  cliente: "Vitro Packaging",
  maq: {
    ...BASE_REPORT.maq,
    nombre: "Granalladora #1 Moldes",
    codigo: "2448620",
    turbinas: 4,
    voltaje: 460,
    producto: "Moldes de Vidrio",
    abrasivo: "S-330",
    ampMax: 19,
    ampIdeal: 15,
    potencia: 42.0,
  },
  hoy: { kwh: 720.9, ampMedio: 11.8, horometro: 14.6, granalla: 52 },
  mes: { kwh: 2980.4, ampMedio: 10.9, horometro: 68.1, granalla: 240 },
};
CLIENT_DATA.nemak = {
  ...BASE_REPORT,
  cliente: "Nemak Monterrey",
  maq: {
    ...BASE_REPORT.maq,
    nombre: "Granalladora #2 Aluminio",
    codigo: "2447310",
    turbinas: 4,
    voltaje: 460,
    producto: "Cabezas de Aluminio",
    abrasivo: "IMPAKT-INOX 10",
    ampMax: 21,
    ampIdeal: 17,
    potencia: 52.0,
  },
  hoy: { kwh: 1054.2, ampMedio: 15.9, horometro: 20.3, granalla: 78 },
  mes: { kwh: 4120.8, ampMedio: 14.7, horometro: 91.6, granalla: 362 },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[10px] font-semibold text-[#5a6a7a]">
        {label}
      </td>
      <td className="border-r border-[#dde3ec] px-2 py-[5px] text-[10px] text-[#2d3f52]">
        {value}
      </td>
      <td className="border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[10px] font-semibold text-[#5a6a7a]">
        {extra}
      </td>
      <td
        className={`border-r border-[#dde3ec] px-2 py-[5px] text-right text-[10px] font-bold ${highlight ? "text-[#1a5fa8]" : "text-[#2d3f52]"}`}
      >
        {extraVal}
      </td>
      <td className="px-2 py-[5px] text-[10px] text-[#8898a8]">{unit}</td>
    </tr>
  );
}

function AmperageChart() {
  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
        {/* Horizontal grid */}
        {Y_TICKS.map((y) => (
          <line
            key={y}
            x1={ML}
            y1={yp(y)}
            x2={CW - MR}
            y2={yp(y)}
            stroke={y === 0 ? "#9aa8b8" : "#dde3ec"}
            strokeWidth={y === 0 ? 0.8 : 0.6}
            strokeDasharray={y > 0 ? "3,3" : undefined}
          />
        ))}
        {/* Major vertical grid */}
        {MAJOR_TICKS.map(({ t }) => (
          <line
            key={t}
            x1={xp(t)}
            y1={MT}
            x2={xp(t)}
            y2={CH - MB}
            stroke="#dde3ec"
            strokeWidth={0.6}
            strokeDasharray="3,3"
          />
        ))}
        {/* Minor vertical grid */}
        {MINOR_TICKS.map(({ t }) => (
          <line
            key={t}
            x1={xp(t)}
            y1={MT}
            x2={xp(t)}
            y2={CH - MB}
            stroke="#eef1f6"
            strokeWidth={0.5}
          />
        ))}

        {/* Reference lines */}
        <line
          x1={ML}
          y1={yp(20)}
          x2={CW - MR}
          y2={yp(20)}
          stroke="#7ec8e3"
          strokeWidth={1}
          strokeDasharray="6,3"
        />
        <line
          x1={ML}
          y1={yp(17)}
          x2={CW - MR}
          y2={yp(17)}
          stroke="#d4a017"
          strokeWidth={1}
          strokeDasharray="6,3"
        />
        <line
          x1={ML}
          y1={yp(5)}
          x2={CW - MR}
          y2={yp(5)}
          stroke="#b0bac8"
          strokeWidth={1}
          strokeDasharray="6,3"
        />

        {/* Turbine lines */}
        {ALL_SERIES.map((s) => (
          <path
            key={s.key}
            d={toPath(s.pts)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Left Y labels */}
        {Y_TICKS.map((y) => (
          <text
            key={y}
            x={ML - 4}
            y={yp(y) + 3.5}
            textAnchor="end"
            fontSize={7.5}
            fill="#8898a8"
          >
            {y}A
          </text>
        ))}
        {/* Right Y labels */}
        {Y_TICKS.map((y) => (
          <text
            key={y}
            x={CW - MR + 4}
            y={yp(y) + 3.5}
            textAnchor="start"
            fontSize={7.5}
            fill="#8898a8"
          >
            {y}A
          </text>
        ))}

        {/* X labels */}
        {MAJOR_TICKS.map(({ t, label }) => (
          <text
            key={t}
            x={xp(t)}
            y={CH - MB + 12}
            textAnchor="middle"
            fontSize={7.5}
            fill="#8898a8"
          >
            {label}
          </text>
        ))}

        {/* Axes */}
        <line
          x1={ML}
          y1={MT}
          x2={ML}
          y2={CH - MB}
          stroke="#b0bac8"
          strokeWidth={0.8}
        />
        <line
          x1={CW - MR}
          y1={MT}
          x2={CW - MR}
          y2={CH - MB}
          stroke="#b0bac8"
          strokeWidth={0.8}
        />
        <line
          x1={ML}
          y1={CH - MB}
          x2={CW - MR}
          y2={CH - MB}
          stroke="#b0bac8"
          strokeWidth={0.8}
        />
        <line
          x1={ML}
          y1={MT}
          x2={CW - MR}
          y2={MT}
          stroke="#b0bac8"
          strokeWidth={0.5}
        />
      </svg>
    </div>
  );
}

function GanttChart() {
  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${CW} ${GH}`} className="w-full">
        {/* Vertical grid */}
        {MAJOR_TICKS.map(({ t }) => (
          <line
            key={t}
            x1={gx(t)}
            y1={GMT}
            x2={gx(t)}
            y2={GH - GMB}
            stroke="#dde3ec"
            strokeWidth={0.6}
            strokeDasharray="3,3"
          />
        ))}
        {MINOR_TICKS.map(({ t }) => (
          <line
            key={t}
            x1={gx(t)}
            y1={GMT}
            x2={gx(t)}
            y2={GH - GMB}
            stroke="#eef1f6"
            strokeWidth={0.5}
          />
        ))}

        {GANTT_ROWS.map((key, rowIdx) => {
          const y = GMT + rowIdx * (ROW_H + ROW_GAP);
          const color = TURB_COLORS[key]!;
          return (
            <g key={key}>
              {/* Track background */}
              <rect
                x={GML}
                y={y}
                width={GPW}
                height={ROW_H}
                fill="#eff2f7"
                rx={2}
              />
              {/* Active segments */}
              {SEGS[key]!.map(([s, e], i) => (
                <rect
                  key={i}
                  x={gx(s)}
                  y={y}
                  width={Math.max(1, gx(e) - gx(s))}
                  height={ROW_H}
                  fill={color}
                  rx={1}
                />
              ))}
              {/* Left label */}
              <text
                x={GML - 5}
                y={y + ROW_H / 2 + 3.5}
                textAnchor="end"
                fontSize={9}
                fontWeight="700"
                fill="#3d4f63"
              >
                {key}
              </text>
              {/* Right label */}
              <text
                x={CW - GMR + 5}
                y={y + ROW_H / 2 + 3.5}
                textAnchor="start"
                fontSize={9}
                fontWeight="700"
                fill="#3d4f63"
              >
                {key}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {MAJOR_TICKS.map(({ t, label }) => (
          <text
            key={t}
            x={gx(t)}
            y={GH - GMB + 12}
            textAnchor="middle"
            fontSize={7.5}
            fill="#8898a8"
          >
            {label}
          </text>
        ))}

        {/* Bottom axis */}
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

function PctBarChart({ turbs }: { turbs: typeof BASE_REPORT.turbs }) {
  const barW = Math.floor((BPW - (turbs.length - 1) * 14) / turbs.length);
  const spacing = barW + 14;
  const startX =
    BML + (BPW - (turbs.length * barW + (turbs.length - 1) * 14)) / 2;

  return (
    <div className="overflow-hidden rounded border border-[#dde3ec] bg-[#fafbfc]">
      <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full">
        {/* Grid */}
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
          const bh = (t.pctDia / 100) * BPH;
          const y = BMT + BPH - bh;
          return (
            <g key={t.id}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={bh}
                fill={t.color}
                rx={2}
              />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={8}
                fontWeight="700"
                fill="#3d4f63"
              >
                {t.pctDia}
              </text>
              <text
                x={x + barW / 2}
                y={BMT + BPH + 15}
                textAnchor="middle"
                fontSize={9}
                fill="#3d4f63"
              >
                {t.id}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={BML}
          y1={BMT + BPH}
          x2={BW - BMR}
          y2={BMT + BPH}
          stroke="#9aa8b8"
          strokeWidth={0.8}
        />
      </svg>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReporteGranalladoDetalle() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const R = CLIENT_DATA[clienteId] ?? BASE_REPORT;

  return (
    <div className="min-h-screen bg-[#eef1f6] py-6 print:bg-white print:py-0">
      {/* Nav breadcrumb (hidden on print) */}
      <div className="mx-auto mb-4 flex max-w-[1120px] items-center gap-2 px-4 text-[12px] text-[#8898a8] print:hidden">
        <Link href="/home" className="hover:text-[#1a5fa8]">
          Inicio
        </Link>
        <span>/</span>
        <Link href="/reporte-diario" className="hover:text-[#1a5fa8]">
          Reporte Granallado
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#3d4f63]">{R.cliente}</span>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded border border-[#dde3ec] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
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

      {/* ── Report card ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1120px] overflow-hidden rounded-xl bg-white shadow-lg print:rounded-none print:shadow-none">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-stretch border-b-2 border-[#dde3ec]">
          {/* Title */}
          <div className="flex flex-1 items-center justify-center px-4 py-2.5">
            <h1 className="text-center text-[13px] font-extrabold tracking-wide text-[#2d3f52] uppercase">
              REPORTE GRANALLADO DIARIO &nbsp;·&nbsp; {R.maq.nombre}
            </h1>
          </div>

          {/* INPLANT logo */}
          <div className="flex shrink-0 items-center gap-2.5 border-l border-[#dde3ec] px-4 py-2.5">
            <div className="text-right text-[8px] leading-tight">
              <div className="text-[10px] font-black tracking-widest text-[#1a7a50]">
                IN PLANT
              </div>
              <div className="text-[#7a8898]">SUPPORT BY</div>
              <div className="font-bold text-[#2d3f52]">DOOBLE</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#2d3f52] text-[13px] font-black text-white">
              D
            </div>
          </div>
        </div>

        {/* ── Client + Date ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[#dde3ec] bg-[#f0f4f8] px-5 py-1.5">
          <span className="text-[15px] font-bold text-[#2d3f52]">
            {R.cliente}
          </span>
          <span className="text-[12px] font-semibold tracking-wide text-[#566778]">
            FECHA:&nbsp; {R.fecha}
          </span>
        </div>

        {/* ── Info panels ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-[1.35fr_1fr] divide-x divide-[#dde3ec] border-b border-[#dde3ec]">
          {/* Machine specs */}
          <table className="w-full">
            <tbody>
              <MaqRow
                label="Maquina"
                value={R.maq.nombre}
                extra="Amp Max."
                extraVal={R.maq.ampMax}
                unit="A"
              />
              <MaqRow
                label="Turbinas"
                value={R.maq.turbinas}
                extra="Amp Vacio"
                extraVal={R.maq.ampVacio}
                unit="A"
              />
              <MaqRow
                label="Voltaje"
                value={R.maq.voltaje}
                extra="Potencia Total"
                extraVal={R.maq.potencia}
                unit="kW"
              />
              <MaqRow
                label="Producto"
                value={R.maq.producto}
                extra="Precio Abr."
                extraVal={`$${R.maq.precioAbr.toFixed(2)}`}
                unit="USD"
                highlight
              />
              <MaqRow
                label="Abrasivo"
                value={R.maq.abrasivo}
                extra="Consumo Abr."
                extraVal={R.maq.consumoAbr.toFixed(2)}
                unit="Kg/hr"
              />
              <tr>
                <td className="border-t border-r border-[#dde3ec] bg-[#f5f7fa] px-2 py-[5px] text-[10px] font-semibold text-[#5a6a7a]">
                  Produccion
                </td>
                <td
                  className="border-t border-[#dde3ec] px-2 py-[5px] text-[10px] text-[#2d3f52]"
                  colSpan={4}
                >
                  {R.maq.produccion} perf/hora
                </td>
              </tr>
            </tbody>
          </table>

          {/* Operation summary */}
          <div className="flex flex-col">
            <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1.5 text-center text-[10px] font-bold tracking-wider text-[#1a5fa8] uppercase">
              Resumen de operación
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                  <th className="px-3 py-1 text-left font-semibold text-[#8898a8]"></th>
                  <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">
                    Valores del día
                  </th>
                  <th className="px-3 py-1 text-right font-semibold text-[#8898a8]">
                    Valores últimos 30 días
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Consumo KWh",
                    hoy: R.hoy.kwh,
                    mes: R.mes.kwh,
                    suffix: "",
                  },
                  {
                    label: "Amp. Medio",
                    hoy: R.hoy.ampMedio,
                    mes: R.mes.ampMedio,
                    suffix: " A",
                  },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-[#dde3ec]">
                    <td className="px-3 py-1 text-[#5a6a7a]">{row.label}</td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {row.hoy}
                      {row.suffix}
                    </td>
                    <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                      {row.mes.toLocaleString()}
                      {row.suffix}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-[#dde3ec] bg-[#f5f7fa]">
                  <td className="px-3 py-1 text-[#5a6a7a]">Horómetro</td>
                  <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                    {R.hoy.horometro}
                  </td>
                  <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                    {R.mes.horometro}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1 text-[#5a6a7a]">Granalla/Día</td>
                  <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                    {R.hoy.granalla} KG
                  </td>
                  <td className="px-3 py-1 text-right font-bold text-[#2d3f52]">
                    Granalla {R.mes.granalla} KG
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Charts section ──────────────────────────────────────────────── */}
        <div className="space-y-4 p-4">
          {/* Line chart */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#2d3f52]">
                Turbinas: Variación de Amperajes
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-[#5a6a7a]">
                {TURBINES.map((t) => (
                  <span key={t.key} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-5 rounded-sm"
                      style={{ background: t.color }}
                    />
                    {t.key}
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke="#7ec8e3"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                  </svg>
                  Amp Máximo
                </span>
                <span className="flex items-center gap-1">
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke="#d4a017"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                  </svg>
                  Amp Ideal
                </span>
                <span className="flex items-center gap-1">
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke="#b0bac8"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                  </svg>
                  Amp de Vacio
                </span>
              </div>
            </div>
            <AmperageChart />
          </div>

          {/* Gantt chart */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-[#2d3f52]">
              Turbinas: Tiempo Granallado Efectivo
            </p>
            <GanttChart />
          </div>

          {/* Bottom: data table + bar chart */}
          <div className="grid grid-cols-[1fr_auto] items-start gap-4">
            {/* Data table */}
            <div className="overflow-hidden rounded border border-[#dde3ec] text-[10px]">
              <div className="grid grid-cols-2 divide-x divide-[#dde3ec]">
                {/* Consumo */}
                <div>
                  <div className="border-b border-[#dde3ec] bg-[#e8eef6] px-3 py-1 text-center text-[10px] font-bold text-[#1a5fa8]">
                    Consumo Eléctrico
                  </div>
                  <table className="w-full">
                    <tbody>
                      {R.turbs.map((t) => (
                        <tr key={t.id} className="border-b border-[#dde3ec]">
                          <td className="px-3 py-1.5">
                            <span
                              className="mr-1.5 inline-block h-2 w-2.5 rounded-sm"
                              style={{ background: t.color }}
                            />
                            {t.id}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-[#2d3f52] tabular-nums">
                            {t.kwh} kWh
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                        <td className="px-3 py-1.5 font-bold text-[#2d3f52]">
                          Total consumo eléctrico
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums">
                          {R.totalKwh} kWh
                        </td>
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
                        <th className="px-2 py-1 text-left font-semibold text-[#8898a8]"></th>
                        <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                          horas
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                          % del día (24H)
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-[#8898a8]">
                          % del Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {R.turbs.map((t) => (
                        <tr key={t.id} className="border-b border-[#dde3ec]">
                          <td className="px-2 py-1.5">
                            <span
                              className="mr-1.5 inline-block h-2 w-2.5 rounded-sm"
                              style={{ background: t.color }}
                            />
                            {t.id}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {t.horas.toFixed(1)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {t.pctDia.toFixed(1)} %
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {t.pctTotal.toFixed(1)} %
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#b0bac8] bg-[#f0f4f8]">
                        <td
                          className="px-2 py-1.5 font-semibold text-[#5a6a7a]"
                          colSpan={2}
                        >
                          Promedio horas Granallado Efectivo
                        </td>
                        <td
                          className="px-2 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums"
                          colSpan={2}
                        >
                          {R.promHoras} h
                        </td>
                      </tr>
                      <tr className="border-t border-[#dde3ec] bg-[#f0f4f8]">
                        <td
                          className="px-2 py-1.5 font-semibold text-[#5a6a7a]"
                          colSpan={2}
                        >
                          Total horas Granallado Efectivo
                        </td>
                        <td
                          className="px-2 py-1.5 text-right font-bold text-[#2d3f52] tabular-nums"
                          colSpan={2}
                        >
                          {R.totalHoras} h
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="w-[280px] shrink-0">
              <p className="mb-0.5 text-center text-[10px] font-bold text-[#2d3f52]">
                Tiempo de Granallado Efectivo
              </p>
              <p className="mb-1 text-center text-[9px] text-[#8898a8]">
                % del día (24H)
              </p>
              <PctBarChart turbs={R.turbs} />
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-[#dde3ec] bg-[#f5f7fa] px-5 py-2">
          <p className="text-[9px] text-[#5a6a7a]">
            <span className="font-semibold">Contacto InPlant</span>
            {" · "}Ing. Miguel Rios
            {" · "}cel: 811 824 3178
            {" · "}email: miguel.rios@dooble-inox.de
          </p>
          <div className="rounded bg-[#2d3f52] px-3 py-1 text-[10px] font-black tracking-widest text-white">
            DOOBLE
          </div>
        </div>
      </div>
    </div>
  );
}
