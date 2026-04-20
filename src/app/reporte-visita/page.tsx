"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "~/trpc/react";
import { LoadingToast } from "~/components/LoadingToast";

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColor = (s: "good" | "warn" | "crit") =>
  s === "good"
    ? "bg-[#1a9e5c]"
    : s === "warn"
      ? "bg-[#d4860a]"
      : "bg-[#d63b3b]";

const statusTextColor = (s: "good" | "warn" | "crit") =>
  s === "good"
    ? "text-[#1a9e5c]"
    : s === "warn"
      ? "text-[#b86d00]"
      : "text-[#d63b3b]";

function pctToStatus(pct: number): "good" | "warn" | "crit" {
  if (pct >= 70) return "good";
  if (pct >= 40) return "warn";
  return "crit";
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtNum(n: bigint | number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("es-MX");
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 text-[13px] font-extrabold tracking-[0.2em] text-[#1a5fa8] uppercase">
      {children}
      <div className="h-px flex-1 bg-[#dde3ec]" />
    </div>
  );
}

// ─── main report ─────────────────────────────────────────────────────────────

function ReporteContent({ idVisita }: { idVisita: number }) {
  const { data, isLoading, isFetching, error } = api.visitas.getReporte.useQuery(
    { id_visita: idVisita },
    { retry: false },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#566778]">
        Cargando reporte…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-[#566778]">
        <div className="text-lg font-semibold text-[#d63b3b]">
          Reporte no encontrado
        </div>
        <div className="flex gap-3">
          <Link href="/reporte-visita" className="flex items-center gap-1.5 rounded-md border border-[#dde3ec] bg-white px-5 py-2.5 text-sm font-semibold text-[#3d4f63] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Ver Reportes
          </Link>
          <Link href="/home" className="flex items-center gap-1.5 rounded-md bg-[#1a5fa8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#134a87]">
            Ir al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const { visita, visitaAnterior, granulometriaIdeal } = data;
  const maquina = visita.maquinas_maestra;
  const turbinas = maquina?.maquinas_turbinas;
  const cliente = maquina?.clientes;
  const ingeniero = maquina?.contactos_maquina?.find(
    (c) => c.rol === "Contacto_In_Plant" || c.rol === "Champion",
  );

  const horometro = Number(visita.horometro_lectura ?? 0);
  const horometroAnterior = Number(visitaAnterior?.horometro_lectura ?? 0);
  const deltaHorometro = horometroAnterior
    ? horometro - horometroAnterior
    : null;

  // Número de reporte formateado
  const numReporte =
    maquina?.numero_inplant && visita.consecutivo_reporte
      ? `${maquina.numero_inplant}-${String(visita.consecutivo_reporte).padStart(4, "0")}`
      : `V-${String(idVisita).padStart(4, "0")}`;

  // ── Vida de componentes ──────────────────────────────────────────────────
  const vidaPaletas = turbinas?.vida_paletas ?? 6000;
  const cantTurbinas = turbinas?.cantidad_turbinas ?? 0;

  const turbinasList = Array.from({ length: cantTurbinas }, (_, i) => {
    const amp = visita.visitas_amperajes.find((a) => a.num_turbina === i + 1);
    const pct =
      vidaPaletas > 0 ? Math.min(100, Math.round((horometro / vidaPaletas) * 100)) : 0;
    return {
      name: `T${i + 1}`,
      pct,
      hours: horometro,
      status: pctToStatus(100 - pct),
      amp: amp ? Number(amp.amperaje_real) : null,
    };
  });

  const componentesVida = [
    turbinas?.vida_blindajes
      ? {
          label: "Blindajes Turbina",
          pct: Math.min(100, Math.round((horometro / turbinas.vida_blindajes) * 100)),
          detail: `${fmtNum(horometro)} / ${fmtNum(turbinas.vida_blindajes)} hr`,
        }
      : null,
    turbinas?.tamano_apertura_caja_control
      ? {
          label: "Caja Control",
          pct: turbinas.vida_impulsor
            ? Math.min(100, Math.round((horometro / turbinas.vida_impulsor) * 100))
            : 0,
          detail: turbinas.tamano_apertura_caja_control,
        }
      : null,
  ].filter(Boolean) as { label: string; pct: number; detail: string }[];

  // ── Granulometría ────────────────────────────────────────────────────────
  const granReal = visita.visitas_granulometria;
  const totalPesoReal = granReal.reduce(
    (s, g) => s + Number(g.peso_gramos ?? 0),
    0,
  );

  const mallasOrden = [
    "2.200","1.700","1.400","1.180","0.850","0.600",
    "0.425","0.300","0.212","0.150","0.090","0.050","POLVO",
  ];

  const granData = mallasOrden
    .map((malla) => {
      const real = granReal.find((g) => g.malla === malla);
      const ideal = granulometriaIdeal.find(
        (g) => g.malla_label === malla,
      );
      if (!real && !ideal) return null;
      const realPct =
        totalPesoReal > 0 ? Number(real?.peso_gramos ?? 0) / totalPesoReal : 0;
      const idealPct = Number(ideal?.proporcion ?? 0);
      return { malla, idealPct, realPct, diff: realPct - idealPct };
    })
    .filter(Boolean) as {
    malla: string;
    idealPct: number;
    realPct: number;
    diff: number;
  }[];

  const maxGran = Math.max(
    ...granData.flatMap((g) => [g.idealPct, g.realPct]),
    0.01,
  );

  // ── KG/HR histórico ──────────────────────────────────────────────────────
  const kghrData = visita.visitas_lecturas_kghr;
  const kghrActual =
    kghrData.length > 0
      ? Number(kghrData[kghrData.length - 1]?.kg_hr ?? 0)
      : null;
  const kghrAjustado =
    kghrData.length > 0
      ? (kghrData[kghrData.length - 1]?.ajustado_manual ?? 0) === 1
      : false;

  const kghrMin = Math.min(...kghrData.map((k) => Number(k.kg_hr ?? 0)));
  const kghrMax = Math.max(...kghrData.map((k) => Number(k.kg_hr ?? 0)), 0.01);

  // ── Granalla instalada ───────────────────────────────────────────────────
  const granInstalada = visita.visitas_granalla_instalada[0];
  const performance = visita.visitas_performance_grano[0];
  const stock = visita.visitas_stock_maquina;

  const stockTotal =
    stock
      ? Number(stock.kg_en_maquina ?? 0) +
        Number(stock.kg_piso ?? 0) +
        Number(stock.kg_recuperada ?? 0)
      : Number(visita.kg_bodega ?? 0);

  // ── Estado ───────────────────────────────────────────────────────────────
  const evalEstado = visita.evaluacion_estado ?? "Buenas condiciones";
  const evalEficiencia = visita.evaluacion_eficiencia ?? "Eficiente";
  const recsMaquina = visita.recomendaciones_maquina
    ? visita.recomendaciones_maquina.split("\n").filter(Boolean)
    : [];
  const recsProceso = visita.recomendaciones_proceso
    ? visita.recomendaciones_proceso.split("\n").filter(Boolean)
    : [];
  const recommendations = [...recsMaquina, ...recsProceso];

  // ─── SVG chart dims ───────────────────────────────────────────────────────
  const chartW = 900;
  const chartH = 140;
  const chartPadL = 35;
  const chartPadR = 20;
  const chartPadTop = 20;
  const chartPadBot = 20;
  const innerW = chartW - chartPadL - chartPadR;
  const innerH = chartH - chartPadTop - chartPadBot;

  const kghrPoints = kghrData.map((k, i) => {
    const x =
      chartPadL + (kghrData.length > 1 ? (i / (kghrData.length - 1)) * innerW : innerW / 2);
    const y =
      chartPadTop +
      innerH -
      ((Number(k.kg_hr ?? 0) - kghrMin) / (kghrMax - kghrMin || 1)) * innerH;
    return { x, y, kg_hr: Number(k.kg_hr ?? 0), fecha: k.fecha_lectura };
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b-[3px] border-[#1a5fa8] bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto grid max-w-300 grid-cols-[auto_1fr_auto] items-stretch">
          {/* Logo + back */}
          <div className="flex items-center gap-3 border-r border-[#dde3ec] px-6 py-3.5">
            <Link
              href="/reporte-visita"
              className="flex items-center gap-1.5 rounded border border-[#dde3ec] px-3 py-1.5 text-sm font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Lista
            </Link>
            <span className="h-4 w-px bg-[#dde3ec]" />
            <Link
              href="/home"
              className=" text-[17px] font-black tracking-wider text-[#0f2137] hover:text-[#1a5fa8] transition-colors"
            >
              DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
            </Link>
          </div>

          {/* Machine info */}
          <div className="flex flex-col justify-center px-6 py-3.5">
            <div className=" text-lg font-bold text-[#0f2137]">
              {maquina?.maquina_por_cliente ?? maquina?.tipo_maquina ?? "Máquina"}
            </div>
            <div className="text-[13px] tracking-wide text-[#566778] uppercase">
              {cliente?.nombre}
              {maquina?.numero_inplant ? ` · No. In-Plant: ${maquina.numero_inplant}` : ""}
              {ingeniero ? ` · ${ingeniero.nombre}` : ""}
              {ingeniero?.email ? ` · ${ingeniero.email}` : ""}
            </div>
          </div>

          {/* Report info */}
          <div className="flex flex-col items-end justify-center gap-0 border-l border-[#dde3ec] px-6 py-3.5">
            <div className=" text-[13px] font-semibold tracking-wide text-[#1a5fa8]">
              # {numReporte}
            </div>
            <div className="mt-0.5 text-[13px] text-[#566778]">
              {fmtDate(visita.fecha_visita)}
            </div>
            <div className="mt-2 flex items-stretch gap-2.5">
              {/* Horómetro actual */}
              <div className="text-right">
                <div className="text-[11px] tracking-widest text-[#566778] uppercase">
                  Horómetro actual
                </div>
                <div className=" text-xl leading-tight font-bold text-[#1a5fa8]">
                  {fmtNum(visita.horometro_lectura)}
                </div>
                <div className="text-[12px] text-[#566778]">hr</div>
              </div>

              {visitaAnterior && (
                <>
                  <div className="w-px bg-[#dde3ec]" />
                  {/* Visita anterior */}
                  <div className="text-right">
                    <div className="text-[11px] tracking-widest text-[#566778] uppercase">
                      Visita anterior
                    </div>
                    <div className=" text-sm leading-tight font-semibold text-[#3d4f63]">
                      {fmtNum(visitaAnterior.horometro_lectura)} hr
                    </div>
                    <div className="text-[12px] text-[#566778]">
                      {fmtDate(visitaAnterior.fecha_visita)}
                    </div>
                  </div>

                  {deltaHorometro !== null && (
                    <>
                      <div className="w-px bg-[#dde3ec]" />
                      {/* Delta */}
                      <div className="text-right">
                        <div className="text-[11px] tracking-widest text-[#566778] uppercase">
                          Δ entre visitas
                        </div>
                        <div className=" text-lg leading-tight font-bold text-[#1a9e5c]">
                          +{fmtNum(deltaHorometro)}
                        </div>
                        <div className="text-[12px] text-[#566778]">
                          hr trabajadas
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto grid max-w-300 gap-6 p-6">
        {/* 01 — Estado General */}
        <div>
          <SectionLabel>01 — Estado General</SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_2fr]">
            {/* Estado */}
            <div className="relative overflow-hidden rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="absolute top-0 right-0 left-0 h-0.75 bg-[#1a9e5c]" />
              <div className="text-[12px] tracking-widest text-[#566778] uppercase">
                Estado de Máquina
              </div>
              <div className="mt-2 text-xl font-bold text-[#1a9e5c]">
                {evalEstado}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#566778]">
                Horómetro{" "}
                <span className=" text-[#3d4f63]">
                  {fmtNum(visita.horometro_lectura)} hr
                </span>
              </div>
            </div>

            {/* Eficiencia */}
            <div className="relative overflow-hidden rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="absolute top-0 right-0 left-0 h-0.75 bg-[#1a9e5c]" />
              <div className="text-[12px] tracking-widest text-[#566778] uppercase">
                Eficiencia de Proceso
              </div>
              <div className="mt-2 text-xl font-bold text-[#1a9e5c]">
                {evalEficiencia}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#566778]">
                Parámetros{" "}
                <span className=" text-[#3d4f63]">
                  dentro de rango
                </span>
              </div>
            </div>

            {/* Recomendaciones */}
            <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="mb-3 text-[12px] tracking-widest text-[#566778] uppercase">
                Recomendaciones
              </div>
              {recommendations.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[14px] leading-relaxed text-[#3d4f63]"
                    >
                      <span className=" text-[12px] text-[#1a5fa8]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-[#566778] italic">
                  Sin recomendaciones registradas.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 02 — Vida de Componentes */}
        {(turbinasList.length > 0 || componentesVida.length > 0) && (
          <div>
            <SectionLabel>02 — Vida de Componentes</SectionLabel>
            <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              {turbinasList.length > 0 && (
                <div
                  className="mb-3.5 grid items-center gap-1.5"
                  style={{
                    gridTemplateColumns: `90px repeat(${turbinasList.length}, 1fr)`,
                  }}
                >
                  <div className="text-[13px] font-bold tracking-wider text-[#1a5fa8] uppercase">
                    Paletas
                  </div>
                  {turbinasList.map((t) => (
                    <div
                      key={t.name}
                      className="rounded border border-[#c8d4e3] bg-white p-2.5"
                    >
                      <div className="mb-1.5 text-[15px] font-bold text-[#0f2137]">
                        {t.name}
                      </div>
                      <div className="h-1.75 overflow-hidden rounded-sm bg-[#dde3ec]">
                        <div
                          className={`h-full rounded-sm ${statusColor(t.status)}`}
                          style={{ width: `${t.pct}%` }}
                        />
                      </div>
                      <div
                        className={`mt-1 text-[15px] font-semibold ${statusTextColor(t.status)}`}
                      >
                        {t.pct}%
                      </div>
                      <div className="mt-0.5 text-[13px] font-medium text-[#3d4f63]">
                        {fmtNum(t.hours)} hr
                      </div>
                      {t.amp !== null && (
                        <div className="mt-0.5 text-[12px] text-[#566778]">
                          {t.amp} A
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {turbinasList.length > 0 && componentesVida.length > 0 && (
                <hr className="my-3 border-[#dde3ec]" />
              )}

              {componentesVida.length > 0 && (
                <div
                  className="grid items-center gap-1.5"
                  style={{
                    gridTemplateColumns: `90px repeat(${componentesVida.length}, 1fr)`,
                  }}
                >
                  <div className="text-[13px] font-bold tracking-wider text-[#1a5fa8] uppercase">
                    Otros
                  </div>
                  {componentesVida.map((c) => {
                    const s = pctToStatus(c.pct);
                    return (
                      <div
                        key={c.label}
                        className="rounded border border-[#dde3ec] bg-white p-3"
                      >
                        <div className="mb-1.5 text-[13px] font-semibold tracking-wider text-[#3d4f63] uppercase">
                          {c.label}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#6b7c8b]">
                            <div
                              className={`h-full rounded-full ${statusColor(s)}`}
                              style={{ width: `${c.pct}%` }}
                            />
                          </div>
                          <span
                            className={` text-[15px] font-semibold ${statusTextColor(s)}`}
                          >
                            {c.pct}%
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-medium text-[#3d4f63]">
                          {c.detail}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 03 — Consumo Histórico KG/HR */}
        {kghrData.length > 0 && (
          <div>
            <SectionLabel>03 — Consumo Histórico KG/HR</SectionLabel>
            <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className=" text-base font-bold text-[#0f2137]">
                    Consumo de Granalla por Hora Efectiva
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#566778]">
                    Últimas {kghrData.length} lecturas
                  </div>
                </div>
                {kghrActual !== null && (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className=" text-[22px] font-bold text-[#1a5fa8]">
                        {kghrActual.toFixed(2)}
                      </div>
                      {kghrAjustado && (
                        <span className="rounded border border-[rgba(212,134,10,0.3)] bg-[rgba(212,134,10,0.1)] px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-[#d4860a] uppercase">
                          Ajustado
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] tracking-wider text-[#566778] uppercase">
                      KG / HR actual
                    </div>
                  </div>
                )}
              </div>

              {kghrPoints.length >= 2 && (
                <svg
                  className="h-40 w-full overflow-visible"
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a5fa8" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1a5fa8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((frac) => (
                    <line
                      key={frac}
                      x1={chartPadL}
                      y1={chartPadTop + innerH * (1 - frac)}
                      x2={chartW - chartPadR}
                      y2={chartPadTop + innerH * (1 - frac)}
                      stroke="#dde3ec"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Area */}
                  <path
                    d={`M ${kghrPoints.map((p) => `${p.x},${p.y}`).join(" L ")} L ${kghrPoints[kghrPoints.length - 1]!.x},${chartPadTop + innerH} L ${kghrPoints[0]!.x},${chartPadTop + innerH} Z`}
                    fill="url(#lineGrad)"
                  />
                  {/* Line */}
                  <polyline
                    points={kghrPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#1a5fa8"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {/* Dots + labels */}
                  {kghrPoints.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={i === kghrPoints.length - 1 ? 5 : 3.5}
                        fill="#1a5fa8"
                        stroke="#eef1f6"
                        strokeWidth={i === kghrPoints.length - 1 ? 2 : 0}
                      />
                      {p.fecha && (
                        <text
                          x={p.x}
                          y={chartPadTop + innerH + 14}
                          fill="#566778"
                          fontSize="12"
                          fontFamily="var(--font-barlow)"
                          textAnchor="middle"
                        >
                          {new Date(p.fecha).toLocaleDateString("es-MX", {
                            month: "short",
                            year: "2-digit",
                          })}
                        </text>
                      )}
                    </g>
                  ))}
                  {kghrActual !== null && (
                    <text
                      x={kghrPoints[kghrPoints.length - 1]!.x}
                      y={(kghrPoints[kghrPoints.length - 1]!.y ?? 0) - 10}
                      fill="#1a5fa8"
                      fontSize="13"
                      fontFamily="var(--font-jetbrains)"
                      textAnchor="middle"
                    >
                      {kghrActual.toFixed(2)}
                    </text>
                  )}
                </svg>
              )}
            </div>
          </div>
        )}

        {/* 04 — Condición de Granalla */}
        {(granData.length > 0 || granInstalada) && (
          <div>
            <SectionLabel>04 — Condición de Granalla</SectionLabel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              {/* Granulometría */}
              {granData.length > 0 && (
                <div className="rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
                  <div className="mb-3.5 flex items-center justify-between">
                    <div>
                      <div className=" text-base font-bold text-[#0f2137]">
                        {granInstalada?.nombre_granalla ?? "Granalla"}
                      </div>
                      <div className="mt-0.5 text-[13px] text-[#566778]">
                        {granInstalada?.medida}{" "}
                        {granInstalada?.detalle_material
                          ? `· ${granInstalada.detalle_material}`
                          : ""}
                      </div>
                    </div>
                    {granInstalada?.comentarios && (
                      <span className="rounded border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.12)] px-2 py-0.5 text-[12px] font-semibold tracking-wider text-[#d4860a] uppercase">
                        {granInstalada.comentarios}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-[60px_1fr_1fr_44px_44px_52px] gap-2 pb-2 text-[12px] font-bold tracking-wider text-[#3d4f63] uppercase">
                    <span>Malla</span>
                    <span>Ideal</span>
                    <span>Real</span>
                    <span className="text-right">Ideal %</span>
                    <span className="text-right">Real %</span>
                    <span className="text-right">Δ</span>
                  </div>

                  {granData.map((g) => {
                    const idealW = Math.round((g.idealPct / maxGran) * 100);
                    const realW = Math.round((g.realPct / maxGran) * 100);
                    const realColor =
                      Math.abs(g.diff) > 0.05 ? "#c87000" : "#1a9e5c";
                    const diffClass =
                      Math.abs(g.diff) < 0.02
                        ? "text-[#5a6e82]"
                        : g.diff > 0
                          ? "text-[#1a9e5c]"
                          : "text-[#d63b3b]";
                    const diffSign = g.diff > 0 ? "+" : "";
                    return (
                      <div
                        key={g.malla}
                        className="grid grid-cols-[60px_1fr_1fr_44px_44px_52px] items-center gap-2 border-b border-[#dde3ec] py-1.5 last:border-b-0"
                      >
                        <span className=" text-xs font-semibold text-[#1a3a5c]">
                          {g.malla}
                        </span>
                        <div className="h-1.75 overflow-hidden rounded-sm bg-[#c8d4e3]">
                          <div
                            className="h-full bg-[#6b8aaa]"
                            style={{ width: `${idealW}%` }}
                          />
                        </div>
                        <div className="h-1.75 overflow-hidden rounded-sm bg-[#c8d4e3]">
                          <div
                            className="h-full"
                            style={{ width: `${realW}%`, background: realColor }}
                          />
                        </div>
                        <span className="text-right text-xs font-semibold text-[#5a6e82]">
                          {(g.idealPct * 100).toFixed(0)}%
                        </span>
                        <span className="text-right text-xs font-semibold text-[#1a3a5c]">
                          {(g.realPct * 100).toFixed(0)}%
                        </span>
                        <span
                          className={`text-right text-xs font-semibold ${diffClass}`}
                        >
                          {diffSign}
                          {(g.diff * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Stock + Performance */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3.5 rounded border border-[#dde3ec] bg-[#f9fafb] p-5">
                  {/* Stock */}
                  <div>
                    <div className="text-[12px] tracking-widest text-[#566778] uppercase">
                      Stock Granalla
                    </div>
                    <div className="mt-1 text-[26px] font-bold text-[#0f2137]">
                      {fmtNum(Math.round(stockTotal))}{" "}
                      <span className="text-xs font-light text-[#566778]">
                        kg
                      </span>
                    </div>
                    {stock && (
                      <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-[#566778]">
                        <span>Máquina: {fmtNum(Number(stock.kg_en_maquina ?? 0))} kg</span>
                        <span>Piso: {fmtNum(Number(stock.kg_piso ?? 0))} kg</span>
                        <span>Recuperada: {fmtNum(Number(stock.kg_recuperada ?? 0))} kg</span>
                      </div>
                    )}
                  </div>

                  {performance && (
                    <>
                      <hr className="border-[#dde3ec]" />
                      <div>
                        <div className="text-[12px] tracking-widest text-[#566778] uppercase">
                          Performance de Grano
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className=" text-xl text-[#d4860a]">
                            {Number(performance.porcentaje_real ?? 0).toFixed(0)}%
                          </span>
                          <span className="text-[13px] text-[#566778]">
                            real vs{" "}
                            <span className="text-[#3d4f63]">
                              {Number(performance.porcentaje_ideal ?? 0).toFixed(0)}% ideal
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dde3ec]">
                          <div
                            className="h-full rounded-full bg-[#d4860a]"
                            style={{
                              width: `${Number(performance.porcentaje_real ?? 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Granalla instalada */}
                {granInstalada && (
                  <div className="rounded border border-[#dde3ec] bg-white p-4">
                    <div className="mb-2 text-[12px] tracking-widest text-[#566778] uppercase">
                      Granalla Instalada
                    </div>
                    <div className="text-[15px] font-medium text-[#1a5fa8]">
                      {granInstalada.nombre_granalla}
                    </div>
                    <div className="text-[13px] text-[#566778]">
                      {granInstalada.medida}
                      {granInstalada.detalle_material
                        ? ` · ${granInstalada.detalle_material}`
                        : ""}
                    </div>
                    {granInstalada.comentarios && (
                      <div className="mt-2.5 rounded border border-[rgba(212,134,10,0.18)] bg-[rgba(212,134,10,0.07)] px-2.5 py-2">
                        <div className="text-[11px] tracking-wider text-[#d4860a] uppercase">
                          Nota del técnico
                        </div>
                        <div className="mt-1 text-[13px] leading-relaxed text-[#3d4f63]">
                          {granInstalada.comentarios}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mx-auto flex max-w-300 items-center justify-between border-t-2 border-[#1a5fa8] px-6 py-3.5">
        <div className="text-[12px] tracking-wide text-[#566778]">
          DOOBLE In-Plant Support · Reporte generado automáticamente desde base
          de datos
        </div>
        <div className=" text-[12px] text-[#6b7c8b]">
          {numReporte} · {fmtDate(visita.fecha_visita)}
        </div>
      </div>

      <LoadingToast loading={isFetching} />
    </div>
  );
}

// ─── estado chip ─────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  OPTIMA: { label: "Óptima", color: "text-[#1a9e5c]", dot: "bg-[#1a9e5c]" },
  BUENAS_CONDICIONES: { label: "Buenas condiciones", color: "text-[#3d4f63]", dot: "bg-[#566778]" },
  FUNCIONAL: { label: "Funcional", color: "text-[#d4860a]", dot: "bg-[#d4860a]" },
  INOPERABLE: { label: "Inoperable", color: "text-[#d63b3b]", dot: "bg-[#d63b3b]" },
};

// ─── lista de reportes ────────────────────────────────────────────────────────

type SortField = "fecha" | "numero";
type SortDir = "asc" | "desc";

function ReportesLista() {
  const router = useRouter();
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: clientes = [], isFetching: fetchingClientes } = api.clientes.list.useQuery();
  const { data: visitas = [], isLoading, isFetching: fetchingVisitas } = api.visitas.listRecientes.useQuery(
    { limit: 500, id_cliente: clienteId ?? undefined },
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const sortedVisitas = [...visitas].sort((a, b) => {
    let cmp = 0;
    if (sortField === "fecha") {
      const ta = a.fecha_visita ? new Date(a.fecha_visita).getTime() : -Infinity;
      const tb = b.fecha_visita ? new Date(b.fecha_visita).getTime() : -Infinity;
      cmp = ta - tb;
    } else {
      cmp = (a.consecutivo_reporte ?? 0) - (b.consecutivo_reporte ?? 0);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedVisitas.length / pageSize));
  const pagedVisitas = sortedVisitas.slice((page - 1) * pageSize, page * pageSize);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? (
      <span className="text-[#c8d4e3]">↕</span>
    ) : (
      <span className="text-[#1a5fa8]">{sortDir === "asc" ? "↑" : "↓"}</span>
    );

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      {/* Header */}
      <header className="border-b-[3px] border-[#1a5fa8] bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link
            href="/home"
            className="flex items-center gap-1.5 rounded border border-[#dde3ec] px-3 py-1.5 text-sm font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Inicio
          </Link>
          <span className="h-4 w-px bg-[#dde3ec]" />
          <span className="text-base font-black tracking-wider text-[#0f2137]">
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </span>
          <span className="text-sm font-semibold tracking-wide text-[#566778] uppercase">
            Reportes de Visita
          </span>
          <div className="flex-1" />
          <Link
            href="/formulario-visita"
            className="flex items-center gap-1.5 rounded-md bg-[#1a5fa8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#134a87]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Visita
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="text-[13px] font-semibold tracking-wider text-[#566778] uppercase">
            Cliente
          </label>
          <select
            value={clienteId ?? ""}
            onChange={(e) => {
              setClienteId(e.target.value ? parseInt(e.target.value) : null);
              setPage(1);
            }}
            className="rounded border border-[#dde3ec] bg-white px-3 py-2 text-[15px] text-[#0f2137] shadow-sm outline-none focus:border-[#1a5fa8]"
          >
            <option value="">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.nombre}
              </option>
            ))}
          </select>
          {clienteId && (
            <button
              onClick={() => { setClienteId(null); setPage(1); }}
              className="text-xs text-[#566778] underline hover:text-[#d63b3b]"
            >
              Limpiar
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[13px] text-[#6b7c8b]">
              {sortedVisitas.length} reporte{sortedVisitas.length !== 1 ? "s" : ""}
            </span>
            <span className="h-4 w-px bg-[#dde3ec]" />
            <label className="text-[13px] font-semibold tracking-wider text-[#566778] uppercase">
              Por página
            </label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded border border-[#dde3ec] bg-white px-3 py-2 text-[14px] text-[#0f2137] shadow-sm outline-none focus:border-[#1a5fa8]"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="py-20 text-center text-sm text-[#566778]">
            Cargando reportes…
          </div>
        ) : sortedVisitas.length === 0 ? (
          <div className="py-20 text-center text-sm text-[#566778]">
            No hay reportes registrados.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[#dde3ec] bg-white shadow-sm">
              {/* Header tabla */}
              <div className="grid grid-cols-[3fr_2fr_1.4fr_1.4fr_auto] items-center gap-6 border-b-2 border-[#dde3ec] bg-[#f4f6f9] px-6 py-3 text-[11px] font-bold tracking-widest text-[#566778] uppercase">
                <span>Máquina / Cliente</span>
                <button
                  onClick={() => toggleSort("fecha")}
                  className="flex items-center gap-1.5 transition-colors hover:text-[#1a5fa8]"
                >
                  Fecha <SortIcon field="fecha" />
                </button>
                <button
                  onClick={() => toggleSort("numero")}
                  className="flex items-center gap-1.5 transition-colors hover:text-[#1a5fa8]"
                >
                  Reporte # <SortIcon field="numero" />
                </button>
                <span>Horómetro</span>
                <span />
              </div>

              {pagedVisitas.map((v) => {
                const maquina = v.maquinas_maestra;
                const cliente = maquina?.clientes;
                const numReporte =
                  maquina?.maquina_por_cliente && v.consecutivo_reporte
                    ? `${v.numero_maquina_inf ?? maquina.maquina_por_cliente}-${String(v.consecutivo_reporte).padStart(4, "0")}`
                    : `V-${String(v.id_visita).padStart(4, "0")}`;
                const estadoInfo =
                  ESTADO_LABEL[v.evaluacion_estado ?? "BUENAS_CONDICIONES"] ??
                  ESTADO_LABEL.BUENAS_CONDICIONES!;

                return (
                  <button
                    key={v.id_visita}
                    onClick={() => router.push(`/reporte-visita?id=${v.id_visita}`)}
                    className="group grid w-full grid-cols-[3fr_2fr_1.4fr_1.4fr_auto] items-center gap-6 border-b border-[#eef1f6] px-6 py-5 text-left transition-colors last:border-0 hover:bg-[#f7f9fc]"
                  >
                    {/* Máquina / Cliente + estado badge */}
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${estadoInfo.dot}`} />
                      <div>
                        <div className="text-[16px] font-bold leading-tight text-[#0f2137]">
                          {maquina?.maquina_por_cliente ?? maquina?.tipo_maquina ?? "—"}
                        </div>
                        <div className="mt-1 text-[14px] text-[#566778]">
                          {cliente?.nombre ?? "—"}
                        </div>
                        <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${estadoInfo.color} bg-[#f4f6f9]`}>
                          {estadoInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Fecha */}
                    <div className="text-[16px] font-medium text-[#3d4f63]">
                      {fmtDate(v.fecha_visita)}
                    </div>

                    {/* Reporte # */}
                    <div className="text-[15px] font-bold text-[#1a5fa8]">
                      {numReporte}
                    </div>

                    {/* Horómetro */}
                    <div>
                      <div className="text-[17px] font-semibold text-[#0f2137]">
                        {fmtNum(v.horometro_lectura)}
                      </div>
                      <div className="text-[12px] tracking-wider text-[#8a9bac] uppercase">hr</div>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center gap-1.5 rounded-lg border border-[#dde3ec] px-4 py-2.5 text-[14px] font-semibold text-[#1a5fa8] transition-colors group-hover:border-[#1a5fa8] group-hover:bg-[#eef4ff]">
                      Ver
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <span className="text-[13px] text-[#6b7c8b]">
                  Página {page} de {totalPages} · {sortedVisitas.length} reportes
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="rounded border border-[#dde3ec] bg-white px-3 py-2 text-[13px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border border-[#dde3ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`rounded border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                          p === page
                            ? "border-[#1a5fa8] bg-[#1a5fa8] text-white"
                            : "border-[#dde3ec] bg-white text-[#566778] hover:border-[#1a5fa8] hover:text-[#1a5fa8]"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded border border-[#dde3ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="rounded border border-[#dde3ec] bg-white px-3 py-2 text-[13px] font-semibold text-[#566778] transition-colors hover:border-[#1a5fa8] hover:text-[#1a5fa8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <LoadingToast loading={fetchingClientes || fetchingVisitas} />
    </div>
  );
}

// ─── page wrapper (necesita Suspense por useSearchParams) ────────────────────

function ReportePage() {
  const params = useSearchParams();
  const idRaw = params.get("id");
  const idVisita = idRaw ? parseInt(idRaw, 10) : null;

  if (!idVisita || isNaN(idVisita)) {
    return <ReportesLista />;
  }

  return <ReporteContent idVisita={idVisita} />;
}

export default function ReporteVisitaPage() {
  return (
    <Suspense>
      <ReportePage />
    </Suspense>
  );
}
