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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a5fa8] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-[#0f2137] to-[#1a5fa8]">
      <div className="w-full max-w-md rounded-lg bg-white p-10 shadow-2xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-[family-name:var(--font-barlow-condensed)] text-3xl font-black tracking-wider text-[#0f2137]">
            DOOBLE
          </h1>
        </div>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#dde3ec]" />
          <span className="text-xs font-semibold tracking-widest text-[#b0bacb] uppercase">
            ACCESO
          </span>
          <div className="h-px flex-1 bg-[#dde3ec]" />
        </div>

        {/* Login Button */}
        <a
          href="/auth/login"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-[#1a5fa8] px-6 py-3.5 font-semibold text-white transition-all hover:bg-[#134a87] hover:shadow-lg"
        >
          <svg
            className="h-5 w-5"
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
          Iniciar Sesión con Auth0
        </a>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[#b0bacb]">
          Acceso protegido por Auth0
        </p>
      </div>
    </div>
  );
}
