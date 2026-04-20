"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

const routes = [
  {
    title: "Formulario de Visita",
    description:
      "Registrar una nueva visita técnica. Captura datos de cliente, stock, máquinas, granulometría y evaluaciones.",
    href: "/formulario-visita",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    color: "border-t-[#1a5fa8]",
    iconColor: "text-[#1a5fa8]",
  },
  {
    title: "Reporte de Visita",
    description:
      "Consultar reportes generados. Visualiza estado de máquinas, histórico KG/HR, granulometría y recomendaciones.",
    href: "/reporte-visita",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    color: "border-t-[#1a9e5c]",
    iconColor: "text-[#1a9e5c]",
  },
  {
    title: "Reporte AMP",
    description:
      "Ver el reporte AMP por cliente. Analiza variación de amperajes, tiempos efectivos y consumo eléctrico por turbina.",
    href: "/reporte-granallado",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    color: "border-t-[#d4860a]",
    iconColor: "text-[#d4860a]",
  },
];

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#1a5fa8] bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <h1 className="text-base font-black tracking-wider text-[#0f2137]">
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </h1>
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

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-[#0f2137]">
            Bienvenido{user?.name ? `, ${user.name}` : ""}
          </h2>
          <p className="mt-2 text-base text-[#566778]">
            Selecciona una opción para continuar
          </p>
        </div>

        {/* Route Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={`group rounded-lg border border-t-[3px] border-[#dde3ec] ${route.color} bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md`}
            >
              <div className={`mb-4 ${route.iconColor}`}>{route.icon}</div>
              <h3 className="text-xl font-bold text-[#0f2137] group-hover:text-[#1a5fa8]">
                {route.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#566778]">
                {route.description}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-[#dde3ec] px-4 py-2 text-sm font-semibold tracking-wide text-[#1a5fa8] transition-colors group-hover:border-[#1a5fa8] group-hover:bg-[#f0f5ff]">
                Abrir
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
