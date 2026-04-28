"use client";

import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useState } from "react";
import { api } from "~/trpc/react";

export default function ReporteGranalladoPage() {
  const { user } = useUser();
  const [search, setSearch] = useState("");

  // Solo clientes que tienen dispositivos con datos reales en la tabla datos
  const { data: clientes, isLoading } = api.datos.getClientesConDatos.useQuery();

  const filtered = (clientes ?? []).filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.codigo ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      {/* Header */}
      <header className="border-b-[3px] border-[#d4860a] bg-white shadow-[0_2px_12px_rgba(212,134,10,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link
            href="/home"
            className="text-base font-black tracking-wider text-[#0f2137] hover:text-[#1a5fa8]"
          >
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </Link>
          <span className="text-[#dde3ec]">/</span>
          <span className="text-base font-semibold text-[#566778]">
            Reporte Granallado Diario
          </span>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-base text-[#566778]">{user.email}</span>
              <a
                href="/auth/logout"
                className="rounded border border-[#dde3ec] px-3 py-2 text-base font-semibold text-[#566778] transition-colors hover:border-[#d63b3b] hover:text-[#d63b3b]"
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
            <h2 className="text-2xl font-bold text-[#0f2137]">
              Seleccionar Cliente
            </h2>
            <p className="mt-1 text-base text-[#566778]">
              {isLoading
                ? "Cargando…"
                : `${filtered.length} cliente${filtered.length !== 1 ? "s" : ""} con telemetría activa`}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <svg
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8898a8]"
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
              placeholder="Buscar cliente o código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pr-4 pl-9 text-base text-[#3d4f63] placeholder:text-[#aab4c0] focus:border-[#d4860a] focus:ring-2 focus:ring-[#d4860a]/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-[#dde3ec] bg-white"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#dde3ec] bg-white py-20 text-center">
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
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-base font-semibold text-[#8898a8]">
              {search
                ? `Sin resultados para "${search}"`
                : "Ningún cliente tiene datos de telemetría registrados"}
            </p>
          </div>
        )}

        {/* Client grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.id_cliente}
                href={`/reporte-diario/${c.id_cliente}`}
                className="group rounded-xl border border-[#dde3ec] bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4860a]/40 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[17px] font-bold text-[#0f2137] group-hover:text-[#d4860a]">
                      {c.nombre}
                    </h3>
                    {c.codigo && (
                      <p className="mt-0.5 text-[14px] text-[#7a8898]">
                        Código: {c.codigo}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e8f7f0] px-2.5 py-0.5 text-[13px] font-semibold text-[#1a9e5c]">
                    IoT activo
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#d4860a] opacity-0 transition-opacity group-hover:opacity-100">
                  Ver reporte
                  <svg
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
