"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";

const MESH_SIZES = [
  "2.200", "1.700", "1.400", "1.180", "0.850", "0.600",
  "0.425", "0.300", "0.212", "0.150", "0.090", "0.050", "Polvo",
];

const GRANALLA_TYPES = [
  "IMPAKT-INOX 30 (0.40–0.80mm)",
  "KUGELNOX 40",
  "GLATTEN 40+",
  "Vulkan Chronital S10",
];

const GRANALLA_DOOBLE = ["IMPAKT-INOX 30", "KUGELNOX 40", "GLATTEN 40+"];

const CLIENTES: Record<string, { nombre: string; maquinas: string[]; ultima: string; granallas: string }> = {
  valeo: {
    nombre: "VALEO THERMAL",
    maquinas: ["052-VAL-01 — Rösler R650/2 (4T)", "052-VAL-02 — Rösler R650/2 (4T)"],
    ultima: "24 Mar 2025",
    granallas: "KUGELNOX 40, GLATTEN 40+",
  },
  nidec: {
    nombre: "NIDEC",
    maquinas: ["052-128-02 — Viking SH2560/WC2500 (2T)", "052-128-01 — Viking SH2560 (2T)"],
    ultima: "29 Mar 2025",
    granallas: "IMPAKT-INOX 30",
  },
  oi: {
    nombre: "O-I MONTERREY",
    maquinas: ["052-OI-01 — Máquina 1", "052-OI-02 — Máquina 2", "052-OI-03 — Máquina 3", "052-OI-04 — Máquina 4"],
    ultima: "15 Feb 2025",
    granallas: "Vulkan S10, KUGELNOX 20",
  },
  pegasus: {
    nombre: "PEGASUS AUTOPARTS",
    maquinas: ["052-PEG-01 — Máquina 1"],
    ultima: "21 Nov 2024",
    granallas: "GLATTEN 40+",
  },
  alcast: {
    nombre: "ALCAST SA DE CV",
    maquinas: ["052-ALC-01 — Máquina 1"],
    ultima: "05 Ene 2024",
    granallas: "IMPAKT-INOX 30",
  },
};

interface BodegaRow { tipo: string; kg: string; ref: string }
interface CompraRow { proveedor: string; granalla: string; granallComp: string; kg: string; ov: string }
interface MachineData {
  horometro: string;
  kgMaquina: string;
  kgPiso: string;
  kgRecuperada: string;
  ampT1: string;
  ampT2: string;
  granValues: number[];
  perfReal: string;
  perfIdeal: string;
  cambioGranalla: boolean;
  nuevaGranalla: string;
  comentarios: string;
  estado: string;
  eficiencia: string;
  recMaquina: string;
  recProceso: string;
}

function defaultMachineData(): MachineData {
  return {
    horometro: "", kgMaquina: "", kgPiso: "", kgRecuperada: "",
    ampT1: "", ampT2: "",
    granValues: Array(13).fill(0),
    perfReal: "", perfIdeal: "",
    cambioGranalla: false, nuevaGranalla: "",
    comentarios: "",
    estado: "BUENAS CONDICIONES",
    eficiencia: "INEFICIENTE: PARAMETROS DENTRO DE RANGO",
    recMaquina: "", recProceso: "",
  };
}

export default function FormularioVisitaPage() {
  const [step, setStep] = useState(1);
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]!);
  const [maquinasChecked, setMaquinasChecked] = useState<boolean[]>([]);
  const [bodegaRows, setBodegaRows] = useState<BodegaRow[]>([{ tipo: GRANALLA_TYPES[0]!, kg: "", ref: "1,900 kg" }]);
  const [compraRows, setCompraRows] = useState<CompraRow[]>([{ proveedor: "dooble", granalla: GRANALLA_DOOBLE[0]!, granallComp: "", kg: "", ov: "" }]);
  const [activeMachine, setActiveMachine] = useState(0);
  const [machineData, setMachineData] = useState<MachineData[]>([]);
  const [kghrEdits, setKghrEdits] = useState<Record<number, { editing: boolean; value: string; adjusted: boolean }>>({});

  const clienteData = cliente ? CLIENTES[cliente] : null;

  const handleClienteChange = useCallback((val: string) => {
    setCliente(val);
    if (val && CLIENTES[val]) {
      const c = CLIENTES[val];
      setMaquinasChecked(c.maquinas.map(() => true));
      setMachineData(c.maquinas.map(() => defaultMachineData()));
      setActiveMachine(0);
    } else {
      setMaquinasChecked([]);
      setMachineData([]);
    }
  }, []);

  const updateMachineField = useCallback((field: keyof MachineData, value: unknown) => {
    setMachineData(prev => prev.map((m, i) => i === activeMachine ? { ...m, [field]: value } : m));
  }, [activeMachine]);

  const updateGranValue = useCallback((idx: number, val: number) => {
    setMachineData(prev => prev.map((m, i) => {
      if (i !== activeMachine) return m;
      const newVals = [...m.granValues];
      newVals[idx] = val;
      return { ...m, granValues: newVals };
    }));
  }, [activeMachine]);

  const currentMachine = machineData[activeMachine];

  const granTotal = useMemo(() => {
    if (!currentMachine) return 0;
    return currentMachine.granValues.reduce((s, v) => s + v, 0);
  }, [currentMachine]);

  const granMax = useMemo(() => {
    if (!currentMachine) return 1;
    return Math.max(...currentMachine.granValues, 1);
  }, [currentMachine]);

  const goToStep = (n: number) => {
    if (n >= 1 && n <= 4) setStep(n);
  };

  const stepLabels = ["Cliente", "Stock", "Máquinas", "Cierre"];

  const saveVisita = () => {
    const numMachines = maquinasChecked.filter(Boolean).length;
    alert(`Visita guardada — se generarán ${numMachines} reportes.\n\n(En producción: INSERT a visitas_encabezado + tablas relacionadas)`);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto flex max-w-[960px] items-center gap-4 px-6 py-3">
          <Link href="/home" className="font-[family-name:var(--font-barlow-condensed)] text-base font-black tracking-wider text-[#0f2137]">
            DOOBLE<span className="text-[#1a5fa8]">·</span>INOX
          </Link>
          <span className="font-[family-name:var(--font-barlow-condensed)] text-sm font-semibold tracking-wide text-[#8494aa] uppercase">
            Nueva Visita Técnica
          </span>
          <div className="flex-1" />
          <span className="font-[family-name:var(--font-jetbrains)] text-xs text-[#8494aa]">
            Paso <span className="font-semibold text-[#1a5fa8]">{step}</span> de 4
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-[3px] bg-[#dde3ec]">
          <div
            className="h-full bg-[#1a5fa8] transition-all duration-400"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      {/* Steps Nav */}
      <nav className="mx-auto flex max-w-[960px] gap-0 px-6 pt-5">
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
              <div
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 font-[family-name:var(--font-jetbrains)] text-[11px] font-semibold transition-all ${
                  isActive
                    ? "border-[#1a5fa8] bg-[#1a5fa8] text-white"
                    : isDone
                      ? "border-[#1a9e5c] bg-[#1a9e5c] text-white"
                      : "border-[#dde3ec] bg-white text-[#b0bacb]"
                }`}
              >
                {isDone ? "✓" : n}
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wider uppercase ${
                  isActive ? "text-[#1a5fa8]" : isDone ? "text-[#1a9e5c]" : "text-[#b0bacb]"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Wizard Body */}
      <div className="mx-auto max-w-[960px] px-6 pt-6">

        {/* PASO 1: Cliente y Fecha */}
        {step === 1 && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <div className="mb-5">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] text-[22px] font-bold text-[#0f2137]">Cliente y Fecha</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Selecciona el cliente y la fecha de la visita.</p>
            </div>

            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Cliente</label>
                  <select
                    value={cliente}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] text-[#0f2137] outline-none transition-colors focus:border-[#1a5fa8] focus:bg-white"
                  >
                    <option value="">— Seleccionar cliente —</option>
                    <option value="valeo">VALEO THERMAL — San Luis Potosí</option>
                    <option value="nidec">NIDEC — Monterrey</option>
                    <option value="oi">O-I MONTERREY</option>
                    <option value="pegasus">PEGASUS AUTOPARTS</option>
                    <option value="alcast">ALCAST SA DE CV</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Fecha de Visita</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] text-[#0f2137] outline-none transition-colors focus:border-[#1a5fa8] focus:bg-white"
                  />
                  <span className="text-[10px] text-[#b0bacb]">Puedes ajustar si estás llenando en oficina</span>
                </div>
              </div>

              {/* Cliente Preview */}
              {clienteData && (
                <div className="mt-4 rounded border border-[#dde3ec] bg-[#f4f6f9] p-4">
                  <div className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[#0f2137]">{clienteData.nombre}</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#8494aa]">
                    <span>{clienteData.maquinas.length} máquinas activas</span>
                    <span>Última visita: <strong className="text-[#3d4f63]">{clienteData.ultima}</strong></span>
                    <span>Granallas: {clienteData.granallas}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Máquinas a visitar */}
            {clienteData && (
              <div className="rounded-md border border-[#dde3ec] bg-white p-4">
                <SectionLabel>Máquinas a visitar</SectionLabel>
                {clienteData.maquinas.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5 border-b border-[#dde3ec] py-2">
                    <input
                      type="checkbox"
                      checked={maquinasChecked[i] ?? true}
                      onChange={() => setMaquinasChecked(prev => prev.map((v, j) => j === i ? !v : v))}
                      className="h-4 w-4 accent-[#1a5fa8]"
                    />
                    <span className="font-[family-name:var(--font-barlow-condensed)] text-[13px] font-semibold text-[#0f2137]">{m}</span>
                  </div>
                ))}
                <span className="mt-2 block text-[10px] text-[#b0bacb]">Desmarca las máquinas que no visitarás hoy.</span>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: Stock y Compras */}
        {step === 2 && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <div className="mb-5">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] text-[22px] font-bold text-[#0f2137]">Stock y Compras del Periodo</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Captura el stock actual en bodega y las compras desde la última visita.</p>
            </div>

            {/* Stock Bodega */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Stock Bodega Actual</SectionLabel>
              <div className="mb-3 rounded bg-[#e8f0fb] px-3 py-2 text-xs text-[#1a5fa8]">
                Captura los kg presentes en bodega del cliente por tipo de granalla.
              </div>

              {/* Header */}
              <div className="mb-1 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 border-b-2 border-[#dde3ec] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Tipo de Granalla</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Kg Bodega</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Ref. Anterior</span>
                <span className="w-8" />
              </div>

              {bodegaRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2 py-2">
                  <select
                    value={row.tipo}
                    onChange={(e) => setBodegaRows(prev => prev.map((r, j) => j === i ? { ...r, tipo: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                  >
                    {GRANALLA_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="0"
                    value={row.kg}
                    onChange={(e) => setBodegaRows(prev => prev.map((r, j) => j === i ? { ...r, kg: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <span className="font-[family-name:var(--font-jetbrains)] text-xs text-[#8494aa]">{row.ref}</span>
                  <button onClick={() => setBodegaRows(prev => prev.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded border border-[#dde3ec] text-[#d63b3b] transition-colors hover:border-[#d63b3b] hover:bg-[#fdf0f0]">×</button>
                </div>
              ))}
              <button
                onClick={() => setBodegaRows(prev => [...prev, { tipo: GRANALLA_TYPES[0]!, kg: "", ref: "—" }])}
                className="mt-2 rounded-md border border-dashed border-[#1a5fa8] px-4 py-2 text-xs font-semibold text-[#1a5fa8] transition-colors hover:bg-[rgba(26,95,168,0.06)]"
              >
                + Agregar tipo de granalla
              </button>
            </div>

            {/* Compras del Periodo */}
            <div className="rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Compras del Periodo</SectionLabel>
              <div className="mb-3 rounded bg-[#e8f0fb] px-3 py-2 text-xs text-[#1a5fa8]">
                Todas las compras desde la última visita hasta hoy.
              </div>

              <div className="mb-1 grid grid-cols-[100px_2fr_1fr_1fr_auto] gap-2 border-b-2 border-[#dde3ec] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Proveedor</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Granalla</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Kg</span>
                <span className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">OV / Ref</span>
                <span className="w-8" />
              </div>

              {compraRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[100px_2fr_1fr_1fr_auto] items-center gap-2 py-2">
                  <select
                    value={row.proveedor}
                    onChange={(e) => setCompraRows(prev => prev.map((r, j) => j === i ? { ...r, proveedor: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-2 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                  >
                    <option value="dooble">DOOBLE</option>
                    <option value="comp">Competencia</option>
                  </select>
                  {row.proveedor === "dooble" ? (
                    <select
                      value={row.granalla}
                      onChange={(e) => setCompraRows(prev => prev.map((r, j) => j === i ? { ...r, granalla: e.target.value } : r))}
                      className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                    >
                      {GRANALLA_DOOBLE.map(t => <option key={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nombre granalla competencia"
                      value={row.granallComp}
                      onChange={(e) => setCompraRows(prev => prev.map((r, j) => j === i ? { ...r, granallComp: e.target.value } : r))}
                      className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                    />
                  )}
                  <input
                    type="number"
                    placeholder="0 kg"
                    value={row.kg}
                    onChange={(e) => setCompraRows(prev => prev.map((r, j) => j === i ? { ...r, kg: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <input
                    type="text"
                    placeholder="OV-2025-441"
                    value={row.ov}
                    onChange={(e) => setCompraRows(prev => prev.map((r, j) => j === i ? { ...r, ov: e.target.value } : r))}
                    className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[13px] outline-none focus:border-[#1a5fa8]"
                  />
                  <button onClick={() => setCompraRows(prev => prev.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded border border-[#dde3ec] text-[#d63b3b] transition-colors hover:border-[#d63b3b] hover:bg-[#fdf0f0]">×</button>
                </div>
              ))}
              <button
                onClick={() => setCompraRows(prev => [...prev, { proveedor: "dooble", granalla: GRANALLA_DOOBLE[0]!, granallComp: "", kg: "", ov: "" }])}
                className="mt-2 rounded-md border border-dashed border-[#1a5fa8] px-4 py-2 text-xs font-semibold text-[#1a5fa8] transition-colors hover:bg-[rgba(26,95,168,0.06)]"
              >
                + Agregar compra
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Máquinas */}
        {step === 3 && clienteData && currentMachine && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <div className="mb-5">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] text-[22px] font-bold text-[#0f2137]">Datos por Máquina</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Completa los datos de cada máquina. Navega entre ellas con las pestañas.</p>
            </div>

            {/* Machine tabs */}
            <div className="mb-4 flex gap-0 overflow-x-auto">
              {clienteData.maquinas.map((m, i) => {
                if (!maquinasChecked[i]) return null;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveMachine(i)}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[12px] font-semibold tracking-wide transition-colors ${
                      activeMachine === i
                        ? "border-[#1a5fa8] bg-white text-[#1a5fa8]"
                        : "border-transparent bg-[#f4f6f9] text-[#8494aa] hover:text-[#3d4f63]"
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${activeMachine === i ? "bg-[#1a5fa8]" : "bg-[#dde3ec]"}`} />
                    {m.split(" — ")[0]}
                  </button>
                );
              })}
            </div>

            {/* Horómetro y Stock */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Horómetro y Stock</SectionLabel>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-4">
                <FieldMono label="Horómetro Actual (hr)" value={currentMachine.horometro} onChange={(v) => updateMachineField("horometro", v)} placeholder="6252" />
                <FieldMono label="Kg en Máquina" value={currentMachine.kgMaquina} onChange={(v) => updateMachineField("kgMaquina", v)} placeholder="0 kg" hint="Recirculando — informativo" />
                <FieldMono label="Kg en Piso" value={currentMachine.kgPiso} onChange={(v) => updateMachineField("kgPiso", v)} placeholder="0 kg" hint="Junto a la máquina" />
                <FieldMono label="Kg Recuperada" value={currentMachine.kgRecuperada} onChange={(v) => updateMachineField("kgRecuperada", v)} placeholder="0 kg" hint="Recuperada del proceso" />
              </div>
            </div>

            {/* Amperajes */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Amperajes por Turbina</SectionLabel>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-1 gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-[11px] font-bold text-[#1a5fa8]">T1</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="—"
                      value={currentMachine.ampT1}
                      onChange={(e) => updateMachineField("ampT1", e.target.value)}
                      className="w-20 rounded border-2 border-[#dde3ec] bg-[#f4f6f9] px-2 py-2 text-center font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[#0f2137] outline-none focus:border-[#1a5fa8]"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-[11px] font-bold text-[#1a5fa8]">T2</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="—"
                      value={currentMachine.ampT2}
                      onChange={(e) => updateMachineField("ampT2", e.target.value)}
                      className="w-20 rounded border-2 border-[#dde3ec] bg-[#f4f6f9] px-2 py-2 text-center font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[#0f2137] outline-none focus:border-[#1a5fa8]"
                    />
                  </div>
                </div>
                <div className="min-w-[160px]">
                  <div className="mb-1.5 text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">Referencia</div>
                  <div className="text-xs text-[#3d4f63]">Vacío: <strong className="font-[family-name:var(--font-jetbrains)]">5.9 A</strong></div>
                  <div className="text-xs text-[#3d4f63]">Máximo: <strong className="font-[family-name:var(--font-jetbrains)]">17.5 A</strong></div>
                </div>
              </div>
            </div>

            {/* Granulometría */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-5">
              <SectionLabel>Granulometría MIX Operativo</SectionLabel>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Left: mesh inputs */}
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Peso por Malla (gramos)</div>
                  {MESH_SIZES.map((mesh, idx) => {
                    const val = currentMachine.granValues[idx] ?? 0;
                    const pct = granTotal > 0 ? ((val / granTotal) * 100).toFixed(1) : "0";
                    const barW = (val / granMax) * 100;
                    return (
                      <div key={mesh} className="flex items-center gap-2 py-1">
                        <span className={`w-10 text-right font-[family-name:var(--font-jetbrains)] text-[11px] ${mesh === "Polvo" ? "text-[#8494aa]" : "text-[#0f2137]"} font-semibold`}>{mesh}</span>
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={val || ""}
                            onChange={(e) => updateGranValue(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 rounded border border-[#dde3ec] bg-[#f4f6f9] px-2 py-1 font-[family-name:var(--font-jetbrains)] text-xs outline-none focus:border-[#1a5fa8]"
                          />
                          <div className="h-3 flex-1 rounded-full bg-[#f4f6f9]">
                            <div
                              className={`h-full rounded-full transition-all ${mesh === "Polvo" ? "bg-[rgba(180,100,0,0.2)]" : "bg-[rgba(26,95,168,0.2)]"}`}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-12 text-right font-[family-name:var(--font-jetbrains)] text-[10px] text-[#8494aa]">{pct}%</span>
                      </div>
                    );
                  })}
                  {/* Total */}
                  <div className="mt-2 flex items-center justify-between border-t border-[#dde3ec] pt-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Total</span>
                    <span className={`font-[family-name:var(--font-jetbrains)] text-sm font-bold ${
                      granTotal === 0 ? "text-[#d4860a]" :
                      granTotal >= 190 && granTotal <= 210 ? "text-[#1a9e5c]" :
                      granTotal >= 150 && granTotal <= 250 ? "text-[#d4860a]" : "text-[#d63b3b]"
                    }`}>{granTotal} g</span>
                  </div>
                </div>

                {/* Right: Performance + Cambio Granalla */}
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Performance de Grano</div>
                  <div className="mb-4 rounded border border-[#dde3ec] bg-[#f4f6f9] p-4">
                    <div className="grid gap-2.5">
                      <FieldMono label="% Performance Real" value={currentMachine.perfReal} onChange={(v) => updateMachineField("perfReal", v)} placeholder="0.0" />
                      <FieldMono label="% Performance Ideal" value={currentMachine.perfIdeal} onChange={(v) => updateMachineField("perfIdeal", v)} placeholder="0.0" />
                    </div>
                  </div>

                  <hr className="my-4 border-[#dde3ec]" />

                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Granalla Instalada</div>
                  <div className="mb-2 text-xs text-[#8494aa]">
                    Actual: <strong className="font-[family-name:var(--font-barlow-condensed)] text-sm text-[#0f2137]">IMPAKT-INOX 30</strong>
                    <span className="ml-1.5 font-[family-name:var(--font-jetbrains)] text-[10px] text-[#b0bacb]">2002-09-02</span>
                  </div>

                  {/* Toggle */}
                  <label className="mb-3 flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={currentMachine.cambioGranalla}
                        onChange={(e) => updateMachineField("cambioGranalla", e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-[#dde3ec] transition-colors peer-checked:bg-[#1a5fa8]" />
                      <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#3d4f63]">¿Cambio de granalla en esta visita?</span>
                  </label>

                  {currentMachine.cambioGranalla && (
                    <div className="mb-4 flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Nueva Granalla</label>
                      <select
                        value={currentMachine.nuevaGranalla}
                        onChange={(e) => updateMachineField("nuevaGranalla", e.target.value)}
                        className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8]"
                      >
                        <option>— Seleccionar —</option>
                        <option>IMPAKT-INOX 30</option>
                        <option>KUGELNOX 40</option>
                        <option>GLATTEN 40+</option>
                        <option>Vulkan Chronital S30</option>
                      </select>
                    </div>
                  )}

                  <hr className="my-4 border-[#dde3ec]" />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Comentarios Granalla</label>
                    <textarea
                      placeholder="Estado del mix, observaciones..."
                      value={currentMachine.comentarios}
                      onChange={(e) => updateMachineField("comentarios", e.target.value)}
                      className="min-h-[72px] resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white"
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
                    {[
                      { value: "OPTIMA", label: "Óptima", color: "green" },
                      { value: "BUENAS CONDICIONES", label: "Buenas", color: "neutral" },
                      { value: "FUNCIONAL", label: "Funcional", color: "yellow" },
                      { value: "INOPERABLE", label: "Inoperable", color: "red" },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors ${
                          currentMachine.estado === opt.value
                            ? opt.color === "green" ? "border-[#1a9e5c] bg-[#e6f7f0] text-[#1a9e5c]"
                            : opt.color === "yellow" ? "border-[#d4860a] bg-[#fdf3e3] text-[#d4860a]"
                            : opt.color === "red" ? "border-[#d63b3b] bg-[#fdf0f0] text-[#d63b3b]"
                            : "border-[#dde3ec] bg-[#f4f6f9] text-[#3d4f63]"
                            : "border-[#dde3ec] bg-white text-[#8494aa] hover:bg-[#f4f6f9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="estado"
                          value={opt.value}
                          checked={currentMachine.estado === opt.value}
                          onChange={(e) => updateMachineField("estado", e.target.value)}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold tracking-wider text-[#8494aa] uppercase">Eficiencia de Proceso</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "EFICIENTE: PARAMETROS DENTRO DE RANGO", label: "Eficiente", color: "green" },
                      { value: "INEFICIENTE: PARAMETROS DENTRO DE RANGO", label: "Ineficiente / Dentro", color: "yellow" },
                      { value: "INEFICIENTE: PARAMETROS FUERA DE RANGO", label: "Ineficiente / Fuera", color: "red" },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors ${
                          currentMachine.eficiencia === opt.value
                            ? opt.color === "green" ? "border-[#1a9e5c] bg-[#e6f7f0] text-[#1a9e5c]"
                            : opt.color === "yellow" ? "border-[#d4860a] bg-[#fdf3e3] text-[#d4860a]"
                            : "border-[#d63b3b] bg-[#fdf0f0] text-[#d63b3b]"
                            : "border-[#dde3ec] bg-white text-[#8494aa] hover:bg-[#f4f6f9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="eficiencia"
                          value={opt.value}
                          checked={currentMachine.eficiencia === opt.value}
                          onChange={(e) => updateMachineField("eficiencia", e.target.value)}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Recomendaciones de Máquina</label>
                  <textarea
                    placeholder="Observaciones sobre estado físico, componentes, desgaste..."
                    value={currentMachine.recMaquina}
                    onChange={(e) => updateMachineField("recMaquina", e.target.value)}
                    className="min-h-[72px] resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">Recomendaciones de Proceso</label>
                  <textarea
                    placeholder="Parámetros operativos, granalla, eficiencia..."
                    value={currentMachine.recProceso}
                    onChange={(e) => updateMachineField("recProceso", e.target.value)}
                    className="min-h-[72px] resize-y rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 text-[13px] outline-none focus:border-[#1a5fa8] focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 4: Cierre */}
        {step === 4 && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <div className="mb-5">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] text-[22px] font-bold text-[#0f2137]">Resumen y Cierre</h2>
              <p className="mt-1 text-xs text-[#8494aa]">Revisa los kg/hr calculados — puedes ajustarlos manualmente antes de guardar.</p>
            </div>

            {/* Stock Nuevo */}
            <div className="mb-4 rounded-md border border-[#dde3ec] bg-white p-4">
              <SectionLabel>Stock Nuevo por Tipo de Granalla</SectionLabel>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                {bodegaRows.map((row, i) => (
                  <div key={i} className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3.5 py-2.5">
                    <div className="text-[10px] font-bold tracking-wider text-[#8494aa] uppercase">{row.tipo.split(" (")[0]}</div>
                    <div className="mt-1 font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#0f2137]">
                      {row.kg || "0"} <span className="text-[11px] font-normal text-[#8494aa]">kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KG/HR por máquina */}
            <SectionLabel>KG/HR por Máquina</SectionLabel>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {clienteData && clienteData.maquinas.map((m, i) => {
                if (!maquinasChecked[i]) return null;
                const md = machineData[i];
                const kghr = kghrEdits[i] ?? { editing: false, value: "2.74", adjusted: false };
                return (
                  <div key={i} className="overflow-hidden rounded-md border border-[#dde3ec]">
                    <div className="bg-[#0f2137] px-5 py-3">
                      <div className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold text-white">{m.split(" — ")[0]} — {clienteData.nombre}</div>
                    </div>
                    <div className="bg-white p-5">
                      <div className="flex justify-between border-b border-[#dde3ec] py-2 text-xs">
                        <span className="text-[#8494aa]">Horómetro actual</span>
                        <span className="font-[family-name:var(--font-jetbrains)] text-[#0f2137]">{md?.horometro || "—"} hr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#dde3ec] py-2 text-xs">
                        <span className="text-[#8494aa]">Estado</span>
                        <span className="text-[#0f2137]">{md?.estado || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-xs font-semibold text-[#3d4f63]">KG / HR</span>
                        <div className="flex items-center gap-2">
                          {kghr.editing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={kghr.value}
                              onChange={(e) => setKghrEdits(prev => ({
                                ...prev,
                                [i]: { editing: true, value: e.target.value, adjusted: true },
                              }))}
                              className="w-20 rounded border border-[#1a5fa8] px-2 py-1 text-center font-[family-name:var(--font-jetbrains)] text-sm font-bold outline-none"
                              autoFocus
                            />
                          ) : (
                            <span className="font-[family-name:var(--font-jetbrains)] text-lg font-bold text-[#1a5fa8]">{kghr.value}</span>
                          )}
                          {kghr.adjusted && (
                            <span className="rounded bg-[#fdf3e3] px-1.5 py-0.5 text-[10px] font-semibold text-[#d4860a]">Ajustado</span>
                          )}
                          <button
                            onClick={() => setKghrEdits(prev => ({
                              ...prev,
                              [i]: { ...kghr, editing: !kghr.editing },
                            }))}
                            className="text-[11px] font-semibold text-[#1a5fa8] hover:underline"
                          >
                            {kghr.editing ? "listo" : "editar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Warning */}
            <div className="rounded-md border border-[rgba(212,134,10,0.2)] bg-[#fdf3e3] p-4">
              <div className="text-xs font-semibold text-[#d4860a]">
                Al guardar se generarán <strong>{maquinasChecked.filter(Boolean).length} reportes</strong> — uno por cada máquina visitada.
              </div>
              <div className="mt-1 text-[11px] text-[#8494aa]">Los valores de KG/HR ajustados manualmente quedan marcados internamente para trazabilidad.</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#dde3ec] bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-3">
          <div className="text-xs text-[#8494aa]">
            {clienteData ? (
              <><strong className="text-[#3d4f63]">{clienteData.nombre}</strong> — {clienteData.maquinas.length} máquinas</>
            ) : (
              <><strong>—</strong> selecciona un cliente para comenzar</>
            )}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => goToStep(step - 1)} className="rounded-md border border-[#dde3ec] bg-white px-4 py-2 text-xs font-semibold text-[#3d4f63] transition-colors hover:bg-[#f4f6f9]">
                ← Atrás
              </button>
            )}
            {step < 4 && (
              <button onClick={() => goToStep(step + 1)} className="rounded-md bg-[#1a5fa8] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#134a87]">
                Continuar →
              </button>
            )}
            {step === 4 && (
              <button onClick={saveVisita} className="rounded-md bg-[#1a9e5c] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#137a47]">
                Guardar y Generar Reportes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable sub-components ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 font-[family-name:var(--font-barlow-condensed)] text-[11px] font-extrabold tracking-[0.2em] text-[#1a5fa8] uppercase">
      {children}
      <div className="h-px flex-1 bg-[#dde3ec]" />
    </div>
  );
}

function FieldMono({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold tracking-wider text-[#8494aa] uppercase">{label}</label>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#dde3ec] bg-[#f4f6f9] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[13px] text-[#0f2137] outline-none transition-colors focus:border-[#1a5fa8] focus:bg-white"
      />
      {hint && <span className="text-[10px] text-[#b0bacb]">{hint}</span>}
    </div>
  );
}
