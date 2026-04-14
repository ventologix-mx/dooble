// Pill fijo bottom-right que aparece mientras cualquier query está cargando.
// Uso: <LoadingToast loading={fetchingA || fetchingB} />

export function LoadingToast({ loading }: { loading: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed right-5 bottom-20 z-[200] flex items-center gap-2.5 rounded-full border border-[#dde3ec] bg-white px-4 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ${
        loading ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      {/* Spinner */}
      <svg
        className="h-3.5 w-3.5 animate-spin text-[#1a5fa8]"
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
      <span className=" text-[12px] font-semibold tracking-wide text-[#3d4f63]">
        Obteniendo datos…
      </span>
    </div>
  );
}
