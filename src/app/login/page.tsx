"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1929]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a5fa8] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a1929]">
      {/* Background decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#1a5fa8] opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#0f2137] opacity-40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a5fa8] opacity-10 blur-3xl" />
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl"
        style={{ animation: "fadeUp 0.5s ease both" }}
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1a5fa8] shadow-lg shadow-[#1a5fa8]/40">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-widest text-white">
            DOOBLE
          </h1>
          <p className="mt-2 text-base text-white/40">Sistema de gestión de reportes</p>
        </div>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">
            Acceso
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Login Button */}
        <a
          href="/auth/login"
          className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#1a5fa8] px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-[#1a5fa8]/30 transition-all duration-200 hover:bg-[#1d6bbf] hover:shadow-xl hover:shadow-[#1a5fa8]/40 active:scale-[0.98]"
        >
          <svg
            className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
          Iniciar Sesión
        </a>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/25">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Acceso protegido por Auth0
        </div>
      </div>
    </div>
  );
}
