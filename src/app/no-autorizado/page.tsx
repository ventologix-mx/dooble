"use client";

export default function NoAutorizadoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1929]">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 text-red-400">
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-black tracking-wider text-white">
          Acceso Denegado
        </h1>
        <p className="mb-8 text-sm text-white/50">
          Tu cuenta no tiene acceso a este sistema. Contacta al administrador
          para que te den de alta.
        </p>
        <a
          href="/auth/logout"
          className="block w-full rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
        >
          Cerrar Sesión
        </a>
      </div>
    </div>
  );
}
