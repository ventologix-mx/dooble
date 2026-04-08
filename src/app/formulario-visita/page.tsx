"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  visitas_encabezado_evaluacion_estado,
  visitas_encabezado_evaluacion_eficiencia,
  visitas_compras_proveedor,
  visitas_granulometria_tipo_muestra,
} from "../../../generated/prisma";

// ── Constants ──────────────────────────────────────────────────────────────

const MESH_SIZES = [
  "2.200","1.700","1.400","1.180","0.850","0.600",
  "0.425","0.300","0.212","0.150","0.090","0.050","POLVO",
];

// ── Types ──────────────────────────────────────────────────────────────────

interface BodegaRow {
  id_granalla: number | null;
  nombre: string;
  kg: string;
}

interface CompraRow {
  proveedor: visitas_compras_proveedor;
  id_granalla: number | null;
  granallaNombre: string;
  granallComp: string;
  kg: string;
  ov: string;
}

interface AmpRow { num_turbina: number; value: string }

interface MachineData {
  id_maquina: number;
  horometro: string;
  kgMaquina: string;
  kgPiso: string;
  kgRecuperada: string;
  amperajes: AmpRow[];
  granValues: number[];
  perfReal: string;
  perfIdeal: string;
  cambioGranalla: boolean;
  granallaCambioId: number | null;
  granallaCambioNombre: string;
  granallInstalada: {
    id_granalla: number | null;
    nombre_granalla: string;
    medida: string;
    detalle_material: string;
    comentarios: string;
  };
  estado: visitas_encabezado_evaluacion_estado;
  eficiencia: visitas_encabezado_evaluacion_eficiencia;
  recMaquina: string;
  recProceso: string;
  kghr: string;
  kghrAjustado: boolean;
}

type MaquinaDB = RouterOutputs["maquinas"]["listByCliente"][number];

function defaultMachineData(m: MaquinaDB): MachineData {
  return {
    id_maquina: m.id_maquina,
    horometro: "",
    kgMaquina: "", kgPiso: "", kgRecuperada: "",
    amperajes: Array.from({ length: m.cantidad_turbinas }, (_, i) => ({
      num_turbina: i + 1,
      value: "",
    })),
    granValues: Array(13).fill(0) as number[],
    perfReal: "", perfIdeal: "",
    cambioGranalla: false,
    granallaCambioId: null,
    granallaCambioNombre: "",
    granallInstalada: {
      id_granalla: m.granalla_instalada?.id_granalla ?? null,
      nombre_granalla: m.granalla_instalada?.nombre_granalla ?? "",
      medida: m.granalla_instalada?.medida ?? "",
      detalle_material: m.granalla_instalada?.detalle_material ?? "",
      comentarios: m.granalla_instalada?.comentarios ?? "",
    },
    estado: visitas_encabezado_evaluacion_estado.BUENAS_CONDICIONES,
    eficiencia: visitas_encabezado_evaluacion_eficiencia.EFICIENTE__PARAMETROS_DENTRO_DE_RANGO,
    recMaquina: "", recProceso: "", kghr: "", kghrAjustado: false,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 font-(family-name:--font-barlow-condensed) text-[11px] font-extrabold tracking-[0.2em] text-[#1a5fa8] uppercase">
      {children}
      <div className="h-px flex-1 bg-[#dde3ec]" />
    </div>
  );
}

function FieldMono({
  label, value, onChange, placeholder, hint, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-(family-name:--font-jetbrains) text-[13px] text-[#0f2137] outline-none transition-colors focus:border-[#1a5fa8] focus:bg-white"
      />
      {hint && <span className="text-[10px] text-[#b0bacb]">{hint}</span>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function FormularioVisitaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]!);
  const [maquinasChecked, setMaquinasChecked] = useState<boolean[]>([]);
  const [bodegaRows, setBodegaRows] = useState<BodegaRow[]>([]);
  const [compraRows, setCompraRows] = useState<CompraRow[]>([]);
  const [activeMachine, setActiveMachine] = useState(0);
  const [machineData, setMachineData] = useState<MachineData[]>([]);
  const initializedClientRef = useRef<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: clientes = [] } = api.clientes.list.useQuery();
  const { data: maquinasDB = [], isLoading: loadingMaquinas } =
    api.maquinas.listByCliente.useQuery(
      { id_cliente: clienteId! },
      { enabled: clienteId !== null },
    );
  const { data: granallasDB = [] } = api.granallas.list.useQuery();
  const { data: stockAnterior } = api.visitas.getStockAnterior.useQuery(
    { id_cliente: clienteId!, fecha },
    { enabled: clienteId !== null },
  );

  // Initialize machine state when DB data arrives for a new client
  if (
    clienteId !== null &&
    maquinasDB.length > 0 &&
    initializedClientRef.current !== clienteId
  ) {
    initializedClientRef.current = clienteId;
    setMaquinasChecked(maquinasDB.map(() => true));
    setMachineData(maquinasDB.map((m) => defaultMachineData(m)));
    setActiveMachine(0);
    if (granallasDB.length > 0) {
      const g = granallasDB[0]!;
      setBodegaRows([{
        id_granalla: g.id_granalla,
        nombre: g.nominacion_comercial ?? g.codigo_dooble ?? "",
        kg: "",
      }]);
    }
  }

  // ── Mutation ─────────────────────────────────────────────────────────────
  const createVisita = api.visitas.create.useMutation({
    onSuccess: (visitasCreadas) => {
      const first = visitasCreadas[0];
      if (first) void router.push(`/reporte-visita?id=${first.id_visita}`);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const clienteData = clientes.find((c) => c.id_cliente === clienteId) ?? null;
  const currentMachine = machineData[activeMachine];

  const handleClienteChange = useCallback((val: string) => {
    const id = val ? parseInt(val, 10) : null;
    setClienteId(id);
    initializedClientRef.current = null;
    setMaquinasChecked([]);
    setMachineData([]);
    setBodegaRows([]);
    setActiveMachine(0);
  }, []);

  const updateMachineField = useCallback(
    <K extends keyof MachineData>(field: K, value: MachineData[K]) => {
      setMachineData((prev) =>
        prev.map((m, i) => (i === activeMachine ? { ...m, [field]: value } : m)),
      );
    },
    [activeMachine],
  );

  const updateGranValue = useCallback(
    (idx: number, val: number) => {
      setMachineData((prev) =>
        prev.map((m, i) => {
          if (i !== activeMachine) return m;
          const newVals = [...m.granValues];
          newVals[idx] = val;
          return { ...m, granValues: newVals };
        }),
      );
    },
    [activeMachine],
  );

  const updateAmpValue = useCallback(
    (turbina: number, val: string) => {
      setMachineData((prev) =>
        prev.map((m, i) => {
          if (i !== activeMachine) return m;
          return {
            ...m,
            amperajes: m.amperajes.map((a) =>
              a.num_turbina === turbina ? { ...a, value: val } : a,
            ),
          };
        }),
      );
    },
    [activeMachine],
  );

  const granTotal = currentMachine?.granValues.reduce((s, v) => s + v, 0) ?? 0;
  const granMax = Math.max(...(currentMachine?.granValues ?? [0]), 1);
  const maquinasVisitadas = maquinasChecked.filter(Boolean).length;
  const isSaving = createVisita.isPending;

  // ── KG/HR calculado por máquina ──────────────────────────────────────────
  const kghrCalculados = useMemo(() => {
    const result: Record<number, number | null> = {};
    const visitadas = machineData.filter((_, i) => maquinasChecked[i]);
    if (visitadas.length === 0) return result;

    // Stock anterior total
    const bodegaAnt = (stockAnterior?.bodegaAnterior ?? []).reduce(
      (s, b) => s + b.kg_bodega,
      0,
    );
    const stockMaqAnt = stockAnterior?.stockMaquinasAnt ?? {};
    const pisoAnt = Object.values(stockMaqAnt).reduce(
      (s, m) => s + m.kg_piso,
      0,
    );
    const recuperadaAnt = Object.values(stockMaqAnt).reduce(
      (s, m) => s + m.kg_recuperada,
      0,
    );
    const enMaquinaAnt = Object.values(stockMaqAnt).reduce(
      (s, m) => s + m.kg_en_maquina,
      0,
    );
    const stockTotalAnt = bodegaAnt + pisoAnt + recuperadaAnt + enMaquinaAnt;

    // Stock actual total (solo máquinas visitadas)
    const bodegaAct = bodegaRows.reduce(
      (s, r) => s + (parseFloat(r.kg) || 0),
      0,
    );
    const pisoAct = visitadas.reduce(
      (s, m) => s + (parseFloat(m.kgPiso) || 0),
      0,
    );
    const recuperadaAct = visitadas.reduce(
      (s, m) => s + (parseFloat(m.kgRecuperada) || 0),
      0,
    );
    const enMaquinaAct = visitadas.reduce(
      (s, m) => s + (parseFloat(m.kgMaquina) || 0),
      0,
    );
    const stockTotalAct = bodegaAct + pisoAct + recuperadaAct + enMaquinaAct;

    // Compras del periodo
    const comprasPeriodo = compraRows.reduce(
      (s, r) => s + (parseFloat(r.kg) || 0),
      0,
    );

    const consumoPeriodo = stockTotalAnt + comprasPeriodo - stockTotalAct;

    // Proration: factor = (HP × delta) / Σ(HP × delta)
    const deltas = visitadas.map((m) => {
      const mdb = maquinasDB.find((x) => x.id_maquina === m.id_maquina);
      const horAnt = mdb?.ultima_visita_horometro ?? 0;
      const horAct = parseFloat(m.horometro) || 0;
      return Math.max(0, horAct - horAnt);
    });

    const sumHpDelta = visitadas.reduce((s, m, i) => {
      const mdb = maquinasDB.find((x) => x.id_maquina === m.id_maquina);
      const hp = mdb?.potencia_hp ?? 0;
      return s + hp * (deltas[i] ?? 0);
    }, 0);

    visitadas.forEach((m, i) => {
      const mdb = maquinasDB.find((x) => x.id_maquina === m.id_maquina);
      const hp = mdb?.potencia_hp ?? 0;
      const delta = deltas[i] ?? 0;
      if (delta === 0 || sumHpDelta === 0) {
        result[m.id_maquina] = null;
        return;
      }
      const factor = (hp * delta) / sumHpDelta;
      const consumoM = consumoPeriodo * factor;
      result[m.id_maquina] = consumoM / delta;
    });

    return result;
  }, [machineData, maquinasChecked, bodegaRows, compraRows, stockAnterior, maquinasDB]);

  const goToStep = (n: number) => { if (n >= 1 && n <= 4) setStep(n); };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveVisita = () => {
    if (!clienteId || !fecha) return;

    createVisita.mutate({
      id_cliente: clienteId,
      fecha,
      stockBodega: bodegaRows
        .filter((r) => r.id_granalla !== null && r.kg !== "")
        .map((r) => ({ id_granalla: r.id_granalla!, kg_bodega: parseFloat(r.kg) || 0 })),
      compras: compraRows
        .filter((r) => r.kg !== "")
        .map((r) => ({
          proveedor: r.proveedor,
          id_granalla:
            r.proveedor === visitas_compras_proveedor.DOOBLE
              ? (r.id_granalla ?? undefined)
              : undefined,
          nombre_granalla_competencia:
            r.proveedor === visitas_compras_proveedor.COMPETENCIA
              ? r.granallComp
              : undefined,
          kg_comprados: parseFloat(r.kg) || 0,
          orden_venta: r.ov || undefined,
        })),
      maquinas: machineData
        .filter((_, i) => maquinasChecked[i])
        .map((m) => ({
          id_maquina: m.id_maquina,
          horometro_lectura: parseFloat(m.horometro) || 0,
          evaluacion_estado: m.estado,
          evaluacion_eficiencia: m.eficiencia,
          recomendaciones_maquina: m.recMaquina || undefined,
          recomendaciones_proceso: m.recProceso || undefined,
          comentarios: m.granallInstalada.comentarios || undefined,
          kg_en_maquina: m.kgMaquina ? parseFloat(m.kgMaquina) : undefined,
          kg_piso: m.kgPiso ? parseFloat(m.kgPiso) : undefined,
          kg_recuperada: m.kgRecuperada ? parseFloat(m.kgRecuperada) : undefined,
          amperajes: m.amperajes
            .filter((a) => a.value !== "")
            .map((a) => ({ num_turbina: a.num_turbina, amperaje_real: parseFloat(a.value) || 0 })),
          granulometria: m.granValues
            .map((peso, idx) => ({
              tipo_muestra: visitas_granulometria_tipo_muestra.MIX,
              malla: MESH_SIZES[idx]!,
              peso_gramos: peso,
            }))
            .filter((g) => g.peso_gramos > 0),
          performance_real: m.perfReal ? parseFloat(m.perfReal) : undefined,
          performance_ideal: m.perfIdeal ? parseFloat(m.perfIdeal) : undefined,
          kg_hr: m.kghr ? parseFloat(m.kghr) : undefined,
          ajustado_manual: m.kghrAjustado,
          granalla_instalada: m.granallInstalada.nombre_granalla
            ? {
                id_granalla: m.cambioGranalla
                  ? (m.granallaCambioId ?? undefined)
                  : (m.granallInstalada.id_granalla ?? undefined),
                nombre_granalla: m.cambioGranalla
                  ? m.granallaCambioNombre
                  : m.granallInstalada.nombre_granalla,
                medida: m.granallInstalada.medida || undefined,
                detalle_material: m.granallInstalada.detalle_material || undefined,
                comentarios: m.granallInstalada.comentarios || undefined,
              }
            : undefined,
        })),
    });
  };

  const stepLabels = ["Cliente", "Stock", "Máquinas", "Cierre"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto flex max-w-240 items-center gap-4 px-6 py-3">
          <Link
            href="/home"
            className="font-(family-name:--font-barlow-condensed) text-base font-black tracking-wider text-[#0f2137]"
          >
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </Link>
          <span className="font-(family-name:--font-barlow-condensed) text-sm font-semibold tracking-wide text-[#8494aa] uppercase">
            Nueva Visita Técnica
          </span>
          <div className="flex-1" />
          <span className="font-(family-name:--font-jetbrains) text-xs text-[#8494aa]">
            Paso <span className="font-semibold text-[#1a5fa8]">{step}</span> de 4
          </span>
        </div>
        <div className="h-0.75 bg-[#dde3ec]">
          <div
            className="h-full bg-[#1a5fa8] transition-all"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      {/* Step nav */}
      <nav className="mx-auto flex max-w-240 px-6 pt-5">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <button
              key={n}
              onClick={() => goToStep(n)}
              className="relative flex flex-1 cursor-pointer flex-col items-center gap-1.5"
            >
              {i < 3 && (
                <div className="absolute top-3.5 left-1/2 right-[-50%] h-0.5 bg-[#dde3ec]" />
              )}
              <div className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 font-(family-name:--font-jetbrains) text-[11px] font-semibold transition-all ${isActive ? "border-[#1a5fa8] bg-[#1a5fa8] text-white" : isDone ? "border-[#1a9e5c] bg-[#1a9e5c] text-white" : "border-[#dde3ec] bg-white text-[#b0bacb]"}`}>
                {isDone ? "✓" : n}
              </div>
              <span className={`text-[10px] font-semibold tracking-wider uppercase ${isActive ? "text-[#1a5fa8]" : isDone ? "text-[#1a9e5c]" : "text-[#b0bacb]"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Body */}
      <div className="mx-auto max-w-240 px-6 pt-6">

        {/* ── PASO 1: Cliente ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-5">
              <h2 className="font-(family-name:--font-barlow-condensed) text-[22px] font-bold text-[#0f2137]">Cliente y Fecha</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Selecciona el cliente y la fecha de la visita.</p>
            </div>

            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Cliente</label>
                  <select
                    value={clienteId ?? ""}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] text-[#0f2137] outline-none focus:border-[#1a5fa8] focus:bg-white"
                  >
                    <option value="">— Seleccionar cliente —</option>
                    {clientes.map((c) => (
                      <option key={c.id_cliente} value={c.id_cliente}>
                        {c.nombre}{c.codigo ? ` (${c.codigo})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Fecha de Visita</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] text-[#0f2137] outline-none focus:border-[#1a5fa8] focus:bg-white"
                  />
                  <span className="text-[10px] text-[#b0bacb]">Puedes ajustar si estás llenando en oficina</span>
                </div>
              </div>

              {clienteData && (
                <div className="mt-4 rounded border border-[#dde3ec] bg-[#f4f6f9] p-4">
                  <div className="font-(family-name:--font-barlow-condensed) text-lg font-bold text-[#0f2137]">{clienteData.nombre}</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#8494aa]">
                    <span>{clienteData.num_maquinas} máquinas activas</span>
                    {clienteData.ultima_visita && (
                      <span>
                        Última visita:{" "}
                        <strong className="text-[#3d4f63]">
                          {new Date(clienteData.ultima_visita).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {clienteId && (
              <div className="rounded-md border border-[#dde3ec] bg-white p-4">
                <SectionLabel>Máquinas a visitar</SectionLabel>
                {loadingMaquinas ? (
                  <p className="text-xs text-[#8494aa]">Cargando máquinas…</p>
                ) : maquinasDB.length === 0 ? (
                  <p className="text-xs text-[#8494aa]">Sin máquinas registradas.</p>
                ) : (
                  maquinasDB.map((m, i) => (
                    <div key={m.id_maquina} className="flex items-center gap-2.5 border-b border-[#dde3ec] py-2 last:border-0">
                      <input
                        type="checkbox"
                        checked={maquinasChecked[i] ?? true}
                        onChange={() => setMaquinasChecked((prev) => prev.map((v, j) => j === i ? !v : v))}
                        className="h-4 w-4 accent-[#1a5fa8]"
                      />
                      <div>
                        <span className="font-(family-name:--font-barlow-condensed) text-[13px] font-semibold text-[#0f2137]">
                          {m.numero_inplant} — {m.maquina_por_cliente ?? m.tipo_maquina}
                        </span>
                        {m.ultima_visita_fecha && (
                          <span className="ml-3 font-(family-name:--font-jetbrains) text-[10px] text-[#8494aa]">
                            última visita: {new Date(m.ultima_visita_fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                            {m.ultima_visita_horometro ? ` · ${m.ultima_visita_horometro.toLocaleString()} hr` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <span className="mt-2 block text-[10px] text-[#b0bacb]">Desmarca las máquinas que no visitarás hoy.</span>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 2: Stock y Compras ──────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="mb-5">
              <h2 className="font-(family-name:--font-barlow-condensed) text-[22px] font-bold text-[#0f2137]">Stock y Compras del Periodo</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Stock actual en bodega y compras desde la última visita.</p>
            </div>

            {/* Stock Bodega */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Stock Bodega Actual</SectionLabel>
              <div className="mb-1 grid grid-cols-[2fr_1fr_auto] gap-2 border-b-2 border-[#dde3ec] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Tipo de Granalla</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Kg Bodega</span>
                <span className="w-8" />
              </div>
              {bodegaRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_auto] items-center gap-2 py-2">
                  <select
                    value={row.id_granalla ?? ""}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      const gran = granallasDB.find((g) => g.id_granalla === id);
                      setBodegaRows((prev) => prev.map((r, j) => j === i ? { ...r, id_granalla: id || null, nombre: gran?.nominacion_comercial ?? gran?.codigo_dooble ?? "" } : r));
                    }}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                  >
                    <option value="">— Seleccionar —</option>
                    {granallasDB.map((g) => (
                      <option key={g.id_granalla} value={g.id_granalla}>
                        {g.nominacion_comercial ?? g.codigo_dooble}{g.medidas ? ` (${g.medidas})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="0"
                    value={row.kg}
                    onChange={(e) => setBodegaRows((prev) => prev.map((r, j) => j === i ? { ...r, kg: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-(family-name:--font-jetbrains) text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <button
                    onClick={() => setBodegaRows((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-8 w-8 items-center justify-center rounded border border-[#dde3ec] text-[#d63b3b] hover:border-[#d63b3b] hover:bg-[#fdf0f0]"
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => setBodegaRows((prev) => [...prev, { id_granalla: null, nombre: "", kg: "" }])}
                className="mt-2 rounded-md border border-dashed border-[#1a5fa8] px-4 py-2 text-xs font-semibold text-[#1a5fa8] hover:bg-[rgba(26,95,168,0.06)]"
              >
                + Agregar tipo de granalla
              </button>
            </div>

            {/* Compras */}
            <div className="rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Compras del Periodo</SectionLabel>
              <div className="mb-1 grid grid-cols-[110px_2fr_1fr_1fr_auto] gap-2 border-b-2 border-[#dde3ec] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Proveedor</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Granalla</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Kg</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">OV / Ref</span>
                <span className="w-8" />
              </div>
              {compraRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[110px_2fr_1fr_1fr_auto] items-center gap-2 py-2">
                  <select
                    value={row.proveedor}
                    onChange={(e) => setCompraRows((prev) => prev.map((r, j) => j === i ? { ...r, proveedor: e.target.value as visitas_compras_proveedor } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-2 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                  >
                    <option value={visitas_compras_proveedor.DOOBLE}>DOOBLE</option>
                    <option value={visitas_compras_proveedor.COMPETENCIA}>Competencia</option>
                  </select>
                  {row.proveedor === visitas_compras_proveedor.DOOBLE ? (
                    <select
                      value={row.id_granalla ?? ""}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        const gran = granallasDB.find((g) => g.id_granalla === id);
                        setCompraRows((prev) => prev.map((r, j) => j === i ? { ...r, id_granalla: id || null, granallaNombre: gran?.nominacion_comercial ?? "" } : r));
                      }}
                      className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                    >
                      <option value="">— Seleccionar —</option>
                      {granallasDB.map((g) => (
                        <option key={g.id_granalla} value={g.id_granalla}>
                          {g.nominacion_comercial ?? g.codigo_dooble}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nombre granalla competencia"
                      value={row.granallComp}
                      onChange={(e) => setCompraRows((prev) => prev.map((r, j) => j === i ? { ...r, granallComp: e.target.value } : r))}
                      className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                    />
                  )}
                  <input
                    type="number"
                    placeholder="0 kg"
                    value={row.kg}
                    onChange={(e) => setCompraRows((prev) => prev.map((r, j) => j === i ? { ...r, kg: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-(family-name:--font-jetbrains) text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <input
                    type="text"
                    placeholder="OV-2025-441"
                    value={row.ov}
                    onChange={(e) => setCompraRows((prev) => prev.map((r, j) => j === i ? { ...r, ov: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-(family-name:--font-jetbrains) text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <button
                    onClick={() => setCompraRows((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-8 w-8 items-center justify-center rounded border border-[#dde3ec] text-[#d63b3b] hover:border-[#d63b3b] hover:bg-[#fdf0f0]"
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => setCompraRows((prev) => [...prev, { proveedor: visitas_compras_proveedor.DOOBLE, id_granalla: null, granallaNombre: "", granallComp: "", kg: "", ov: "" }])}
                className="mt-2 rounded-md border border-dashed border-[#1a5fa8] px-4 py-2 text-xs font-semibold text-[#1a5fa8] hover:bg-[rgba(26,95,168,0.06)]"
              >
                + Agregar compra
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Datos por Máquina ────────────────────────────── */}
        {step === 3 && currentMachine && (
          <div>
            <div className="mb-5">
              <h2 className="font-(family-name:--font-barlow-condensed) text-[22px] font-bold text-[#0f2137]">Datos por Máquina</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Completa los datos de cada máquina visitada.</p>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex overflow-x-auto">
              {maquinasDB.map((m, i) => {
                if (!maquinasChecked[i]) return null;
                return (
                  <button
                    key={m.id_maquina}
                    onClick={() => setActiveMachine(i)}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[12px] font-semibold tracking-wide transition-colors ${activeMachine === i ? "border-[#1a5fa8] bg-white text-[#1a5fa8]" : "border-transparent bg-[#f4f6f9] text-[#8494aa] hover:text-[#3d4f63]"}`}
                  >
                    <div className={`h-2 w-2 rounded-full ${activeMachine === i ? "bg-[#1a5fa8]" : "bg-[#dde3ec]"}`} />
                    {m.numero_inplant ?? `M${i + 1}`}
                  </button>
                );
              })}
            </div>

            {/* Horómetro y Stock */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Horómetro y Stock en Máquina</SectionLabel>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-4">
                <FieldMono label="Horómetro Actual (hr)" value={currentMachine.horometro} onChange={(v) => updateMachineField("horometro", v)} placeholder="6252" type="number" />
                <FieldMono label="Kg en Máquina" value={currentMachine.kgMaquina} onChange={(v) => updateMachineField("kgMaquina", v)} placeholder="0 kg" hint="Recirculando" type="number" />
                <FieldMono label="Kg en Piso" value={currentMachine.kgPiso} onChange={(v) => updateMachineField("kgPiso", v)} placeholder="0 kg" type="number" />
                <FieldMono label="Kg Recuperada" value={currentMachine.kgRecuperada} onChange={(v) => updateMachineField("kgRecuperada", v)} placeholder="0 kg" type="number" />
              </div>
            </div>

            {/* Amperajes — dinámico según cantidad_turbinas */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Amperajes por Turbina</SectionLabel>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-wrap gap-3">
                  {currentMachine.amperajes.map((amp) => {
                    const mdb = maquinasDB[activeMachine];
                    return (
                      <div key={amp.num_turbina} className="flex flex-col items-center gap-1">
                        <label className="text-[11px] font-bold text-[#1a5fa8]">T{amp.num_turbina}</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="—"
                          value={amp.value}
                          onChange={(e) => updateAmpValue(amp.num_turbina, e.target.value)}
                          className="w-20 rounded border-2 border-[#dde3ec] bg-[#f4f6f9] px-2 py-2 text-center font-(family-name:--font-jetbrains) text-lg font-semibold text-[#0f2137] outline-none focus:border-[#1a5fa8]"
                        />
                        {mdb?.amp_vacio !== null && (
                          <span className="text-[9px] text-[#b0bacb]">vacío {mdb?.amp_vacio} A</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {maquinasDB[activeMachine]?.amp_maximo && (
                  <div className="min-w-35">
                    <div className="mb-1.5 text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Referencia</div>
                    <div className="text-xs text-[#3d4f63]">Vacío: <strong className="font-(family-name:--font-jetbrains)">{maquinasDB[activeMachine]?.amp_vacio} A</strong></div>
                    <div className="text-xs text-[#3d4f63]">Máximo: <strong className="font-(family-name:--font-jetbrains)">{maquinasDB[activeMachine]?.amp_maximo} A</strong></div>
                  </div>
                )}
              </div>
            </div>

            {/* Granulometría */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Granulometría MIX Operativo</SectionLabel>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Inputs por malla */}
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Peso por Malla (gramos)</div>
                  {MESH_SIZES.map((mesh, idx) => {
                    const val = currentMachine.granValues[idx] ?? 0;
                    const pct = granTotal > 0 ? ((val / granTotal) * 100).toFixed(1) : "0";
                    const barW = (val / granMax) * 100;
                    return (
                      <div key={mesh} className="flex items-center gap-2 py-1">
                        <span className={`w-10 text-right font-(family-name:--font-jetbrains) text-[11px] font-semibold ${mesh === "POLVO" ? "text-[#8494aa]" : "text-[#0f2137]"}`}>
                          {mesh}
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={val || ""}
                            onChange={(e) => updateGranValue(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 rounded border border-[#dde3ec] bg-[#f4f6f9] px-2 py-1 font-(family-name:--font-jetbrains) text-xs outline-none focus:border-[#1a5fa8]"
                          />
                          <div className="h-3 flex-1 rounded-full bg-[#f4f6f9]">
                            <div
                              className={`h-full rounded-full transition-all ${mesh === "POLVO" ? "bg-[rgba(180,100,0,0.2)]" : "bg-[rgba(26,95,168,0.2)]"}`}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-12 text-right font-(family-name:--font-jetbrains) text-[10px] text-[#8494aa]">{pct}%</span>
                      </div>
                    );
                  })}
                  <div className="mt-2 flex items-center justify-between border-t border-[#dde3ec] pt-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Total</span>
                    <span className={`font-(family-name:--font-jetbrains) text-sm font-bold ${granTotal === 0 ? "text-[#d4860a]" : granTotal >= 190 && granTotal <= 210 ? "text-[#1a9e5c]" : granTotal >= 150 && granTotal <= 250 ? "text-[#d4860a]" : "text-[#d63b3b]"}`}>
                      {granTotal} g
                    </span>
                  </div>
                </div>

                {/* Performance + Granalla instalada */}
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Performance de Grano</div>
                  <div className="mb-4 rounded border border-[#dde3ec] bg-[#f4f6f9] p-4">
                    <div className="grid gap-2.5">
                      <FieldMono label="% Performance Real" value={currentMachine.perfReal} onChange={(v) => updateMachineField("perfReal", v)} placeholder="0.0" type="number" />
                      <FieldMono label="% Performance Ideal" value={currentMachine.perfIdeal} onChange={(v) => updateMachineField("perfIdeal", v)} placeholder="0.0" type="number" />
                    </div>
                  </div>

                  <hr className="my-4 border-[#dde3ec]" />

                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Granalla Instalada</div>
                  {currentMachine.granallInstalada.nombre_granalla ? (
                    <div className="mb-2 text-xs text-[#8494aa]">
                      Actual: <strong className="font-(family-name:--font-barlow-condensed) text-sm text-[#0f2137]">{currentMachine.granallInstalada.nombre_granalla}</strong>
                      {currentMachine.granallInstalada.medida && (
                        <span className="ml-1.5 font-(family-name:--font-jetbrains) text-[10px] text-[#b0bacb]">{currentMachine.granallInstalada.medida}</span>
                      )}
                    </div>
                  ) : (
                    <div className="mb-2 text-xs italic text-[#8494aa]">Sin granalla instalada registrada</div>
                  )}

                  <label className="mb-3 flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input type="checkbox" checked={currentMachine.cambioGranalla} onChange={(e) => updateMachineField("cambioGranalla", e.target.checked)} className="peer sr-only" />
                      <div className="h-5 w-9 rounded-full bg-[#dde3ec] transition-colors peer-checked:bg-[#1a5fa8]" />
                      <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#3d4f63]">¿Cambio de granalla en esta visita?</span>
                  </label>

                  {currentMachine.cambioGranalla && (
                    <div className="mb-4 flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Nueva Granalla</label>
                      <select
                        value={currentMachine.granallaCambioId ?? ""}
                        onChange={(e) => {
                          const id = parseInt(e.target.value);
                          const gran = granallasDB.find((g) => g.id_granalla === id);
                          updateMachineField("granallaCambioId", id || null);
                          updateMachineField("granallaCambioNombre", gran?.nominacion_comercial ?? gran?.codigo_dooble ?? "");
                        }}
                        className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                      >
                        <option value="">— Seleccionar —</option>
                        {granallasDB.map((g) => (
                          <option key={g.id_granalla} value={g.id_granalla}>
                            {g.nominacion_comercial ?? g.codigo_dooble}{g.medidas ? ` (${g.medidas})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <hr className="my-4 border-[#dde3ec]" />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Comentarios Granalla</label>
                    <textarea
                      placeholder="Estado del mix, observaciones..."
                      value={currentMachine.granallInstalada.comentarios}
                      onChange={(e) => updateMachineField("granallInstalada", { ...currentMachine.granallInstalada, comentarios: e.target.value })}
                      className="min-h-18 resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Evaluación y Recomendaciones */}
            <div className="rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Evaluación y Recomendaciones</SectionLabel>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Estado de Máquina</div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: visitas_encabezado_evaluacion_estado.OPTIMA, label: "Óptima", color: "green" },
                      { value: visitas_encabezado_evaluacion_estado.BUENAS_CONDICIONES, label: "Buenas condiciones", color: "neutral" },
                      { value: visitas_encabezado_evaluacion_estado.FUNCIONAL, label: "Funcional", color: "yellow" },
                      { value: visitas_encabezado_evaluacion_estado.INOPERABLE, label: "Inoperable", color: "red" },
                    ] as const).map((opt) => (
                      <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors ${currentMachine.estado === opt.value ? opt.color === "green" ? "border-[#1a9e5c] bg-[#e6f7f0] text-[#1a9e5c]" : opt.color === "yellow" ? "border-[#d4860a] bg-[#fdf3e3] text-[#d4860a]" : opt.color === "red" ? "border-[#d63b3b] bg-[#fdf0f0] text-[#d63b3b]" : "border-[#dde3ec] bg-[#f4f6f9] text-[#3d4f63]" : "border-[#dde3ec] bg-white text-[#8494aa] hover:bg-[#f4f6f9]"}`}>
                        <input type="radio" name="estado" value={opt.value} checked={currentMachine.estado === opt.value} onChange={() => updateMachineField("estado", opt.value)} className="sr-only" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Eficiencia de Proceso</div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: visitas_encabezado_evaluacion_eficiencia.EFICIENTE__PARAMETROS_DENTRO_DE_RANGO, label: "Eficiente", color: "green" },
                      { value: visitas_encabezado_evaluacion_eficiencia.INEFICIENTE__PARAMETROS_DENTRO_DE_RANGO, label: "Ineficiente / Dentro de rango", color: "yellow" },
                      { value: visitas_encabezado_evaluacion_eficiencia.INEFICIENTE__PARAMETROS_FUERA_DE_RANGO, label: "Ineficiente / Fuera de rango", color: "red" },
                    ] as const).map((opt) => (
                      <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors ${currentMachine.eficiencia === opt.value ? opt.color === "green" ? "border-[#1a9e5c] bg-[#e6f7f0] text-[#1a9e5c]" : opt.color === "yellow" ? "border-[#d4860a] bg-[#fdf3e3] text-[#d4860a]" : "border-[#d63b3b] bg-[#fdf0f0] text-[#d63b3b]" : "border-[#dde3ec] bg-white text-[#8494aa] hover:bg-[#f4f6f9]"}`}>
                        <input type="radio" name="eficiencia" value={opt.value} checked={currentMachine.eficiencia === opt.value} onChange={() => updateMachineField("eficiencia", opt.value)} className="sr-only" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Recomendaciones de Máquina</label>
                  <textarea placeholder="Una recomendación por línea..." value={currentMachine.recMaquina} onChange={(e) => updateMachineField("recMaquina", e.target.value)} className="min-h-18 resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Recomendaciones de Proceso</label>
                  <textarea placeholder="Una recomendación por línea..." value={currentMachine.recProceso} onChange={(e) => updateMachineField("recProceso", e.target.value)} className="min-h-18 resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 4: Cierre ───────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="mb-5">
              <h2 className="font-(family-name:--font-barlow-condensed) text-[22px] font-bold text-[#0f2137]">Resumen y Cierre</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Captura el KG/HR y guarda la visita.</p>
            </div>

            {/* Stock resumen */}
            {bodegaRows.some((r) => r.kg) && (
              <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-4">
                <SectionLabel>Stock Bodega Capturado</SectionLabel>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
                  {bodegaRows.filter((r) => r.kg).map((row, i) => (
                    <div key={i} className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3.5 py-2.5">
                      <div className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">{row.nombre || "—"}</div>
                      <div className="mt-1 font-(family-name:--font-jetbrains) text-xl font-bold text-[#0f2137]">
                        {row.kg} <span className="text-[11px] font-normal text-[#8494aa]">kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KG/HR por máquina */}
            <SectionLabel>KG/HR por Máquina</SectionLabel>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {maquinasDB.map((m, i) => {
                if (!maquinasChecked[i]) return null;
                const md = machineData[i];
                if (!md) return null;
                const calculado = kghrCalculados[m.id_maquina];
                const calculadoStr =
                  calculado !== null && calculado !== undefined
                    ? calculado.toFixed(2)
                    : null;
                return (
                  <div key={m.id_maquina} className="overflow-hidden rounded-md border border-[#dde3ec]">
                    <div className="bg-[#0f2137] px-5 py-3">
                      <div className="font-(family-name:--font-barlow-condensed) text-sm font-bold text-white">
                        {m.numero_inplant} — {clienteData?.nombre}
                      </div>
                    </div>
                    <div className="bg-white p-5">
                      <div className="flex justify-between border-b border-[#dde3ec] py-2 text-xs">
                        <span className="text-[#8494aa]">Horómetro actual</span>
                        <span className="font-(family-name:--font-jetbrains) text-[#0f2137]">{md.horometro || "—"} hr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#dde3ec] py-2 text-xs">
                        <span className="text-[#8494aa]">Estado</span>
                        <span className="text-[#0f2137]">{md.estado.replace(/_/g, " ")}</span>
                      </div>
                      {calculadoStr && !md.kghrAjustado && (
                        <div className="flex justify-between border-b border-[#dde3ec] py-2 text-xs">
                          <span className="text-[#8494aa]">KG/HR calculado</span>
                          <span className="font-(family-name:--font-jetbrains) font-semibold text-[#1a9e5c]">{calculadoStr}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#3d4f63]">KG / HR</span>
                          {md.kghrAjustado && (
                            <span className="rounded border border-[rgba(212,134,10,0.3)] bg-[rgba(212,134,10,0.1)] px-1.5 py-0.5 font-(family-name:--font-jetbrains) text-[9px] font-bold tracking-wider text-[#d4860a] uppercase">
                              Ajustado
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={calculadoStr ?? "—"}
                          value={md.kghr}
                          onChange={(e) => {
                            const val = e.target.value;
                            const isManual = calculadoStr
                              ? val !== calculadoStr
                              : val !== "";
                            setMachineData((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, kghr: val, kghrAjustado: isManual }
                                  : x,
                              ),
                            );
                          }}
                          onFocus={() => {
                            // Pre-fill with calculated value on first focus if empty
                            if (!md.kghr && calculadoStr) {
                              setMachineData((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, kghr: calculadoStr } : x,
                                ),
                              );
                            }
                          }}
                          className="w-24 rounded border border-[#1a5fa8] px-2 py-1 text-center font-(family-name:--font-jetbrains) text-sm font-bold text-[#1a5fa8] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border border-[rgba(212,134,10,0.2)] bg-[#fdf3e3] p-4">
              <div className="text-xs font-semibold text-[#d4860a]">
                Al guardar se generarán <strong>{maquinasVisitadas} reportes</strong> — uno por cada máquina visitada.
              </div>
              <div className="mt-1 text-[11px] text-[#8494aa]">
                Los datos se guardan en la base de datos. Serás redirigido al primer reporte generado.
              </div>
            </div>

            {createVisita.error && (
              <div className="mt-3 rounded-md border border-[rgba(214,59,59,0.3)] bg-[#fdf0f0] p-4 text-xs text-[#d63b3b]">
                Error: {createVisita.error.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer fijo */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#dde3ec] bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-240 items-center justify-between px-6 py-3">
          <div className="text-xs text-[#8494aa]">
            {clienteData ? (
              <><strong className="text-[#3d4f63]">{clienteData.nombre}</strong> — {maquinasVisitadas} máquina{maquinasVisitadas !== 1 ? "s" : ""}</>
            ) : (
              <>Selecciona un cliente para comenzar</>
            )}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => goToStep(step - 1)} disabled={isSaving} className="rounded-md border border-[#dde3ec] bg-white px-4 py-2 text-xs font-semibold text-[#3d4f63] hover:bg-[#f4f6f9] disabled:opacity-50">
                ← Atrás
              </button>
            )}
            {step < 4 && (
              <button onClick={() => goToStep(step + 1)} disabled={!clienteId} className="rounded-md bg-[#1a5fa8] px-5 py-2 text-xs font-semibold text-white hover:bg-[#134a87] disabled:opacity-40">
                Continuar →
              </button>
            )}
            {step === 4 && (
              <button onClick={saveVisita} disabled={isSaving || !clienteId} className="rounded-md bg-[#1a9e5c] px-5 py-2 text-xs font-semibold text-white hover:bg-[#137a47] disabled:opacity-50">
                {isSaving ? "Guardando…" : "Guardar y Generar Reportes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
