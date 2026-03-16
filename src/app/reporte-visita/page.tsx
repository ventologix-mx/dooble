"use client";

import Link from "next/link";

const GRAN_DATA = [
  { malla: "0.600", ideal: 0.45, real: 0.52 },
  { malla: "0.425", ideal: 0.25, real: 0.26 },
  { malla: "0.300", ideal: 0.15, real: 0.13 },
  { malla: "0.212", ideal: 0.08, real: 0.05 },
  { malla: "0.150", ideal: 0.04, real: 0.02 },
  { malla: "POLVO", ideal: 0.03, real: 0.02 },
];

const MAX_GRAN = Math.max(...GRAN_DATA.flatMap((g) => [g.ideal, g.real]));

const TURBINES = [
  { name: "T1", pct: 85, hours: 664, status: "good" as const },
  { name: "T2", pct: 85, hours: 664, status: "good" as const },
  { name: "T3", pct: 38, hours: 2464, status: "warn" as const },
  { name: "T4", pct: 38, hours: 2464, status: "warn" as const },
  { name: "T5", pct: 62, hours: 1500, status: "warn" as const },
  { name: "T6", pct: 38, hours: 2464, status: "warn" as const },
  { name: "T7", pct: 38, hours: 2464, status: "warn" as const },
  { name: "T8", pct: 38, hours: 2464, status: "warn" as const },
];

const COMPONENTS = [
  { label: "Caja Control (T3–T8)", pct: 59, detail: "2,464 / 6,000 hr", color: "warn" as const },
  { label: "Blindajes Turbina", pct: 85, detail: "est. vida restante", color: "good" as const },
  { label: "Filtros Colector", pct: 66, detail: "2,011 / 6,000 hr", color: "warn" as const },
  { label: "Blindajes Puntos Calientes", pct: 85, detail: "est. vida restante", color: "good" as const },
];

const RECOMMENDATIONS = [
  "Máquina operando en buenas condiciones. Blindajes y placas de cabina en buen estado.",
  "Paletas de turbina en buen estado — sin desgaste ni desajuste visible.",
  "Colector funcionando correctamente. Se requiere reunión con mantenimiento para revisar sacudida periódica de filtros — se aprecia polvo en mix operativo.",
];

const statusColor = (s: "good" | "warn" | "crit") =>
  s === "good" ? "bg-[#1a9e5c]" : s === "warn" ? "bg-[#d4860a]" : "bg-[#d63b3b]";

const statusTextColor = (s: "good" | "warn" | "crit") =>
  s === "good" ? "text-[#1a9e5c]" : s === "warn" ? "text-[#b86d00]" : "text-[#d63b3b]";

export default function ReporteVisitaPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#1a5fa8] bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[auto_1fr_auto] items-stretch">
          {/* Logo */}
          <div className="flex items-center gap-3 border-r border-[#dde3ec] px-6 py-3.5">
            <Link href="/home" className="font-[family-name:var(--font-barlow-condensed)] text-[17px] font-black tracking-wider text-[#0f2137]">
              DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
            </Link>
          </div>
          {/* Machine info */}
          <div className="flex flex-col justify-center px-6 py-3.5">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[#0f2137]">
              Máquina #8 Spinner Hanger — 2 Turbinas
            </div>
            <div className="text-[11px] tracking-wide text-[#8494aa] uppercase">
              PEGASUS AUTOPARTS · No. In-Plant: 052-141-08 · Ing. Miguel Rios · miguel.rios@dooble-inox.de
            </div>
          </div>
          {/* Report info */}
          <div className="flex flex-col items-end justify-center gap-0 border-l border-[#dde3ec] px-6 py-3.5">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] font-semibold tracking-wide text-[#1a5fa8]"># 052-141-08-1459</div>
            <div className="mt-0.5 text-[11px] text-[#8494aa]">21 Nov 2025</div>
            <div className="mt-2 flex items-stretch gap-2.5">
              {/* Horómetro actual */}
              <div className="text-right">
                <div className="text-[9px] tracking-widest text-[#8494aa] uppercase">Horómetro actual</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold leading-tight text-[#1a5fa8]">2,464</div>
                <div className="text-[10px] text-[#8494aa]">hr</div>
              </div>
              <div className="w-px bg-[#dde3ec]" />
              {/* Visita anterior */}
              <div className="text-right">
                <div className="text-[9px] tracking-widest text-[#8494aa] uppercase">Visita anterior</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold leading-tight text-[#3d4f63]">2,315 hr</div>
                <div className="text-[10px] text-[#8494aa]">04 Nov 2025</div>
              </div>
              <div className="w-px bg-[#dde3ec]" />
              {/* Delta */}
              <div className="text-right">
                <div className="text-[9px] tracking-widest text-[#8494aa] uppercase">Δ entre visitas</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold leading-tight text-[#1a9e5c]">+149</div>
                <div className="text-[10px] text-[#8494aa]">hr trabajadas</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto grid max-w-[1200px] gap-5 p-6">

        {/* Section 1: Estado General */}
        <div>
          <SectionLabel>01 — Estado General</SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_2fr]">
            {/* Machine Status */}
            <div className="relative overflow-hidden rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="absolute top-0 right-0 left-0 h-[3px] bg-[#1a9e5c]" />
              <div className="text-[10px] tracking-widest text-[#8494aa] uppercase">Estado de Máquina</div>
              <div className="mt-2 font-[family-name:var(--font-barlow-condensed)] text-xl font-bold text-[#1a9e5c]">Buenas Condiciones</div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#8494aa]">
                Horómetro <span className="font-[family-name:var(--font-jetbrains)] text-[#3d4f63]">2,464 hr</span>
              </div>
            </div>
            {/* Process Efficiency */}
            <div className="relative overflow-hidden rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="absolute top-0 right-0 left-0 h-[3px] bg-[#1a9e5c]" />
              <div className="text-[10px] tracking-widest text-[#8494aa] uppercase">Eficiencia de Proceso</div>
              <div className="mt-2 font-[family-name:var(--font-barlow-condensed)] text-xl font-bold text-[#1a9e5c]">Eficiente</div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#8494aa]">
                Parámetros <span className="font-[family-name:var(--font-jetbrains)] text-[#3d4f63]">dentro de rango</span>
              </div>
            </div>
            {/* Recommendations */}
            <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="mb-3 text-[10px] tracking-widest text-[#8494aa] uppercase">Recomendaciones</div>
              <ul className="flex flex-col gap-2">
                {RECOMMENDATIONS.map((rec, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[#3d4f63]">
                    <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#1a5fa8]">{String(i + 1).padStart(2, "0")}</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Section 2: Vida de Componentes */}
        <div>
          <SectionLabel>02 — Vida de Componentes</SectionLabel>
          <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
            {/* Turbines */}
            <div className="mb-3.5 grid grid-cols-[90px_repeat(8,1fr)] items-center gap-1.5">
              <div className="text-[11px] font-bold tracking-wider text-[#1a5fa8] uppercase">Paletas</div>
              {TURBINES.map((t) => (
                <div key={t.name} className="rounded border border-[#c8d4e3] bg-white p-2.5">
                  <div className="mb-1.5 font-[family-name:var(--font-barlow-condensed)] text-[15px] font-bold text-[#0f2137]">{t.name}</div>
                  <div className="h-[7px] overflow-hidden rounded-sm bg-[#dde3ec]">
                    <div className={`h-full rounded-sm ${statusColor(t.status)}`} style={{ width: `${t.pct}%` }} />
                  </div>
                  <div className={`mt-1 font-[family-name:var(--font-jetbrains)] text-[13px] font-semibold ${statusTextColor(t.status)}`}>{t.pct}%</div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#3d4f63]">{t.hours.toLocaleString()} hr</div>
                </div>
              ))}
            </div>

            <hr className="my-3 border-[#dde3ec]" />

            {/* Other components */}
            <div className="grid grid-cols-[90px_repeat(4,1fr)] items-center gap-1.5">
              <div className="text-[11px] font-bold tracking-wider text-[#1a5fa8] uppercase">Otros</div>
              {COMPONENTS.map((c) => (
                <div key={c.label} className="rounded border border-[#dde3ec] bg-white p-3">
                  <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-[#3d4f63] uppercase">{c.label}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#b0bacb]">
                      <div className={`h-full rounded-full ${statusColor(c.color)}`} style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-semibold ${statusTextColor(c.color)}`}>{c.pct}%</span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-[#3d4f63]">{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Histórico KG/HR */}
        <div>
          <SectionLabel>03 — Consumo Histórico KG/HR</SectionLabel>
          <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="font-[family-name:var(--font-barlow-condensed)] text-base font-bold text-[#0f2137]">Consumo de Granalla por Hora Efectiva</div>
                <div className="mt-0.5 text-[11px] text-[#8494aa]">Últimas 12 visitas — valor tomado al momento de la visita</div>
              </div>
              <div className="text-right">
                <div className="font-[family-name:var(--font-jetbrains)] text-[22px] font-bold text-[#1a5fa8]">2.53</div>
                <div className="text-[10px] tracking-wider text-[#8494aa] uppercase">KG / HR actual</div>
              </div>
            </div>

            <svg className="h-40 w-full overflow-visible" viewBox="0 0 900 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a5fa8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#1a5fa8" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Grid */}
              <line x1="0" y1="32" x2="900" y2="32" stroke="#dde3ec" strokeWidth="1" />
              <line x1="0" y1="80" x2="900" y2="80" stroke="#dde3ec" strokeWidth="1" />
              <line x1="0" y1="128" x2="900" y2="128" stroke="#dde3ec" strokeWidth="1" />
              {/* Y labels */}
              <text x="5" y="30" fill="#8494aa" fontSize="10" fontFamily="var(--font-jetbrains)">3.0</text>
              <text x="5" y="78" fill="#8494aa" fontSize="10" fontFamily="var(--font-jetbrains)">2.0</text>
              <text x="5" y="126" fill="#8494aa" fontSize="10" fontFamily="var(--font-jetbrains)">1.0</text>
              {/* Area */}
              <path d="M 75,115 L 150,80 L 225,93 L 300,71 L 375,112 L 450,95 L 525,68 L 600,100 L 675,90 L 750,75 L 825,105 L 825,140 L 75,140 Z" fill="url(#lineGrad)" />
              {/* Line */}
              <polyline points="75,115 150,80 225,93 300,71 375,112 450,95 525,68 600,100 675,90 750,75 825,105" fill="none" stroke="#1a5fa8" strokeWidth="2" strokeLinejoin="round" />
              {/* Dots */}
              {[
                [75, 115], [150, 80], [225, 93], [300, 71], [375, 112],
                [450, 95], [525, 68], [600, 100], [675, 90],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#1a5fa8" />
              ))}
              <circle cx="750" cy="75" r="3.5" fill="#1a5fa8" stroke="#eef1f6" strokeWidth="2" />
              <circle cx="825" cy="105" r="5" fill="#1a5fa8" stroke="#eef1f6" strokeWidth="2" />
              <text x="825" y="58" fill="#1a5fa8" fontSize="11" fontFamily="var(--font-jetbrains)" textAnchor="middle">2.53</text>
              {/* Date labels */}
              {["Ene'24", "Mar", "May", "Jul", "Ago", "Sep", "Oct", "Dic", "Ene'25", "Oct"].map((label, i) => (
                <text key={i} x={75 + i * 75} y="156" fill="#8494aa" fontSize="9" fontFamily="var(--font-barlow)" textAnchor="middle">{label}</text>
              ))}
              <text x="825" y="156" fill="#1a5fa8" fontSize="9" fontFamily="var(--font-barlow)" textAnchor="middle" fontWeight="600">Nov ←</text>
            </svg>
          </div>
        </div>

        {/* Section 4: Condición de Granalla */}
        <div>
          <SectionLabel>04 — Condición de Granalla</SectionLabel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            {/* Granulometry Table */}
            <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <div>
                  <div className="font-[family-name:var(--font-barlow-condensed)] text-base font-bold text-[#0f2137]">GLATTEN 40+</div>
                  <div className="mt-0.5 text-[11px] text-[#8494aa]">0.40–0.80 mm · Esférica · Zinc</div>
                </div>
                <span className="rounded border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.12)] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#d4860a] uppercase">
                  MIX CON EXCESO GRANO NUEVO
                </span>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[60px_1fr_1fr_44px_44px_52px] gap-2 pb-2 text-[10px] font-bold tracking-wider text-[#3d4f63] uppercase">
                <span>Malla</span>
                <span>Ideal</span>
                <span>Real</span>
                <span className="text-right">Ideal %</span>
                <span className="text-right">Real %</span>
                <span className="text-right">Δ</span>
              </div>

              {/* Data rows */}
              {GRAN_DATA.map((g) => {
                const diff = g.real - g.ideal;
                const idealW = Math.round((g.ideal / MAX_GRAN) * 100);
                const realW = Math.round((g.real / MAX_GRAN) * 100);
                const realColor = Math.abs(diff) > 0.05 ? "#c87000" : "#1a9e5c";
                const diffClass = Math.abs(diff) < 0.02 ? "text-[#5a6e82]" : diff > 0 ? "text-[#1a9e5c]" : "text-[#d63b3b]";
                const diffSign = diff > 0 ? "+" : "";

                return (
                  <div key={g.malla} className="grid grid-cols-[60px_1fr_1fr_44px_44px_52px] items-center gap-2 border-b border-[#dde3ec] py-1.5 last:border-b-0">
                    <span className="font-[family-name:var(--font-jetbrains)] text-xs font-semibold text-[#1a3a5c]">{g.malla}</span>
                    <div className="h-[7px] overflow-hidden rounded-sm bg-[#c8d4e3]">
                      <div className="h-full bg-[#6b8aaa]" style={{ width: `${idealW}%` }} />
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-sm bg-[#c8d4e3]">
                      <div className="h-full" style={{ width: `${realW}%`, background: realColor }} />
                    </div>
                    <span className="text-right font-[family-name:var(--font-jetbrains)] text-xs font-semibold text-[#5a6e82]">{(g.ideal * 100).toFixed(0)}%</span>
                    <span className="text-right font-[family-name:var(--font-jetbrains)] text-xs font-semibold text-[#1a3a5c]">{(g.real * 100).toFixed(0)}%</span>
                    <span className={`text-right font-[family-name:var(--font-jetbrains)] text-xs font-semibold ${diffClass}`}>{diffSign}{(diff * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            {/* Stock + Performance */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3.5 rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
                {/* Stock */}
                <div>
                  <div className="text-[10px] tracking-widest text-[#8494aa] uppercase">Stock Granalla</div>
                  <div className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-[26px] font-bold text-[#0f2137]">
                    320 <span className="text-xs font-light text-[#8494aa]">kg</span>
                  </div>
                </div>
                <hr className="border-[#dde3ec]" />
                {/* Performance */}
                <div>
                  <div className="text-[10px] tracking-widest text-[#8494aa] uppercase">Performance de Grano</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-[family-name:var(--font-jetbrains)] text-xl text-[#d4860a]">91%</span>
                    <span className="text-[11px] text-[#8494aa]">real vs <span className="text-[#3d4f63]">ideal</span></span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dde3ec]">
                    <div className="h-full rounded-full bg-[#d4860a]" style={{ width: "91%" }} />
                  </div>
                </div>
                <hr className="border-[#dde3ec]" />
                {/* Densidad */}
                <div>
                  <div className="text-[10px] tracking-widest text-[#8494aa] uppercase">Densidad Aparente</div>
                  <div className="mt-1 font-[family-name:var(--font-jetbrains)] text-sm text-[#3d4f63]">4.10 g/cm³</div>
                </div>
              </div>

              {/* Granalla Instalada */}
              <div className="rounded border border-[#dde3ec] bg-white p-4">
                <div className="mb-2 text-[10px] tracking-widest text-[#8494aa] uppercase">
                  Granalla Instalada
                  <span className="ml-1.5 font-[family-name:var(--font-jetbrains)] text-[9px] text-[#b0bacb]">2003-09-05</span>
                </div>
                <div className="text-[13px] font-medium text-[#1a5fa8]">GLATTEN 40+</div>
                <div className="text-[11px] text-[#8494aa]">0.40–0.80 mm · Alambre Zinc</div>
                <div className="mt-2.5 rounded border border-[rgba(212,134,10,0.18)] bg-[rgba(212,134,10,0.07)] px-2.5 py-2">
                  <div className="text-[9px] tracking-wider text-[#d4860a] uppercase">Nota del técnico</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-[#3d4f63]">MIX OPERATIVO CON EXCESO DE GRANO NUEVO</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto flex max-w-[1200px] items-center justify-between border-t-2 border-[#1a5fa8] px-6 py-3.5">
        <div className="text-[10px] tracking-wide text-[#8494aa]">
          DOOBLE-INOX In-Plant Support · Reporte generado automáticamente desde base de datos
        </div>
        <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#b0bacb]">
          052-141-08-1459 · 2025-11-21
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 font-[family-name:var(--font-barlow-condensed)] text-[11px] font-extrabold tracking-[0.2em] text-[#1a5fa8] uppercase">
      {children}
      <div className="h-px flex-1 bg-[#dde3ec]" />
    </div>
  );
}
