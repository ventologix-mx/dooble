"use client";

import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";

// ─── Mock clients ─────────────────────────────────────────────────────────────

const CLIENTES = [
  {
    id: "frontera-aluminios",
    nombre: "Frontera Aluminios",
    maquina: "Granalladora #1 Perfiles",
    codigo: "2452502",
    turbinas: 4,
    ultimaFecha: "04/15/2026",
    ampMedio: 14.7,
    horasEfectivas: 18.9,
    consumoKwh: 916.3,
    status: "operativa" as const,
  },
  {
    id: "industrias-monterrey",
    nombre: "Industrias Monterrey SA",
    maquina: "Granalladora #2 Estructural",
    codigo: "2451890",
    turbinas: 6,
    ultimaFecha: "04/14/2026",
    ampMedio: 13.2,
    horasEfectivas: 16.4,
    consumoKwh: 1240.8,
    status: "operativa" as const,
  },
  {
    id: "aceros-del-norte",
    nombre: "Aceros del Norte",
    maquina: "Granalladora #1 Tubería",
    codigo: "2450341",
    turbinas: 2,
    ultimaFecha: "04/13/2026",
    ampMedio: 9.1,
    horasEfectivas: 11.2,
    consumoKwh: 384.5,
    status: "alerta" as const,
  },
  {
    id: "metalsa",
    nombre: "Metalsa Ramos Arizpe",
    maquina: "Granalladora #3 Chasis",
    codigo: "2449780",
    turbinas: 8,
    ultimaFecha: "04/15/2026",
    ampMedio: 17.3,
    horasEfectivas: 22.1,
    consumoKwh: 2180.4,
    status: "operativa" as const,
  },
  {
    id: "vitro",
    nombre: "Vitro Packaging",
    maquina: "Granalladora #1 Moldes",
    codigo: "2448620",
    turbinas: 4,
    ultimaFecha: "04/12/2026",
    ampMedio: 11.8,
    horasEfectivas: 14.6,
    consumoKwh: 720.9,
    status: "inactiva" as const,
  },
  {
    id: "nemak",
    nombre: "Nemak Monterrey",
    maquina: "Granalladora #2 Aluminio",
    codigo: "2447310",
    turbinas: 4,
    ultimaFecha: "04/15/2026",
    ampMedio: 15.9,
    horasEfectivas: 20.3,
    consumoKwh: 1054.2,
    status: "operativa" as const,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  operativa: {
    dot: "bg-[#1a9e5c]",
    badge: "bg-[#e8f7f0] text-[#1a9e5c]",
    label: "Operativa",
  },
  alerta: {
    dot: "bg-[#d4860a]",
    badge: "bg-[#fef6e8] text-[#d4860a]",
    label: "Alerta",
  },
  inactiva: {
    dot: "bg-[#8898a8]",
    badge: "bg-[#f0f2f5] text-[#8898a8]",
    label: "Inactiva",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReporteGranalladoPage() {
  const { user } = useUser();
  const [search, setSearch] = useState("");

  const filtered = CLIENTES.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.maquina.toLowerCase().includes(search.toLowerCase()) ||
      c.codigo.includes(search),
  );

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#d4860a] bg-white shadow-[0_2px_12px_rgba(212,134,10,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link href="/home" className="text-base font-black tracking-wider text-[#0f2137] hover:text-[#1a5fa8]">
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </Link>
          <span className="text-[#dde3ec]">/</span>
          <span className="text-sm font-semibold text-[#566778]">Reporte Granallado Diario</span>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#566778]">{user.email}</span>
              <a
                href="/auth/logout"
                className="rounded border border-[#dde3ec] px-3 py-2 text-sm font-semibold text-[#566778] transition-colors hover:border-[#d63b3b] hover:text-[#d63b3b]"
              >
                Cerrar Sesión
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Title row */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#0f2137]">Seleccionar Cliente</h2>
            <p className="mt-1 text-sm text-[#566778]">
              {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8898a8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente o máquina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pl-9 pr-4 text-sm text-[#3d4f63] placeholder:text-[#aab4c0] focus:border-[#d4860a] focus:outline-none focus:ring-2 focus:ring-[#d4860a]/20"
            />
          </div>
        </div>

        {/* Client grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#dde3ec] bg-white py-20 text-center">
            <svg className="mb-3 h-10 w-10 text-[#aab4c0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-[#8898a8]">Sin resultados para &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const st = STATUS_STYLES[c.status];
              return (
                <Link
                  key={c.id}
                  href={`/reporte-granallado/${c.id}`}
                  className="group rounded-xl border border-[#dde3ec] bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4860a]/40 hover:shadow-md"
                >
                  {/* Top row */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-[#0f2137] group-hover:text-[#d4860a]">
                        {c.nombre}
                      </h3>
                      <p className="mt-0.5 truncate text-[12px] text-[#7a8898]">{c.maquina}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.badge}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg bg-[#f5f7fa] p-3">
                    <div className="text-center">
                      <p className="text-[11px] text-[#8898a8]">Amp. Medio</p>
                      <p className="text-[14px] font-bold text-[#0f2137]">{c.ampMedio}A</p>
                    </div>
                    <div className="text-center border-x border-[#dde3ec]">
                      <p className="text-[11px] text-[#8898a8]">Horómetro</p>
                      <p className="text-[14px] font-bold text-[#0f2137]">{c.horasEfectivas}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#8898a8]">Consumo</p>
                      <p className="text-[14px] font-bold text-[#0f2137]">{c.consumoKwh}</p>
                      <p className="text-[10px] text-[#8898a8]">kWh</p>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between text-[11px] text-[#8898a8]">
                    <span>
                      <span className="font-semibold text-[#566778]">Código:</span> {c.codigo}
                      {" · "}
                      <span className="font-semibold text-[#566778]">Turbinas:</span> {c.turbinas}
                    </span>
                    <span>{c.ultimaFecha}</span>
                  </div>

                  {/* Arrow */}
                  <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#d4860a] opacity-0 transition-opacity group-hover:opacity-100">
                    Ver reporte
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
