"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { RoleGuard } from "~/components/RoleGuard";

type TipoAcceso = "email" | "dominio";
type Rol = "super_admin" | "cliente";

const EMPTY_FORM = {
  tipo: "email" as TipoAcceso,
  valor: "",
  rol: "cliente" as Rol,
  id_cliente: null as number | null,
};

function RolBadge({ rol }: { rol: Rol }) {
  return rol === "super_admin" ? (
    <span className="inline-flex items-center gap-1 rounded bg-[#1a5fa8]/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-[#1a5fa8] uppercase">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      Super Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-[#1a9e5c]/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-[#1a9e5c] uppercase">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
      Cliente
    </span>
  );
}

function UsuariosContent() {
  const utils = api.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: usuarios, isLoading: loadingUsuarios } =
    api.auth.listUsuarios.useQuery();
  const { data: clientes } = api.clientes.listSimple.useQuery();

  const createMutation = api.auth.createUsuario.useMutation({
    onSuccess: async () => {
      await utils.auth.listUsuarios.invalidate();
      setForm(EMPTY_FORM);
      setShowForm(false);
      setErrorMsg(null);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const toggleMutation = api.auth.toggleActivo.useMutation({
    onSuccess: () => utils.auth.listUsuarios.invalidate(),
  });

  const deleteMutation = api.auth.deleteUsuario.useMutation({
    onSuccess: async () => {
      await utils.auth.listUsuarios.invalidate();
      setDeleteConfirm(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const valorLimpio = form.valor.trim().replace(/^@/, "");

    if (!valorLimpio) {
      setErrorMsg("Ingresa un correo o dominio.");
      return;
    }
    if (form.rol === "cliente" && !form.id_cliente) {
      setErrorMsg("Selecciona el cliente asociado.");
      return;
    }

    createMutation.mutate({
      email: form.tipo === "email" ? valorLimpio : null,
      dominio: form.tipo === "dominio" ? valorLimpio : null,
      rol: form.rol,
      id_cliente: form.rol === "cliente" ? form.id_cliente : null,
    });
  }

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      {/* Header */}
      <header className="border-b-[3px] border-[#1a5fa8] bg-white shadow-[0_2px_12px_rgba(26,95,168,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link
            href="/home"
            className="flex items-center gap-1.5 text-sm text-[#566778] transition-colors hover:text-[#1a5fa8]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Inicio
          </Link>
          <span className="text-[#dde3ec]">/</span>
          <h1 className="text-base font-black tracking-wider text-[#0f2137]">
            Gestión de Usuarios
          </h1>
          <span className="rounded bg-[#1a5fa8]/10 px-2 py-0.5 text-xs font-semibold tracking-widest text-[#1a5fa8] uppercase">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {/* Add User Card */}
        <div className="rounded-lg border border-[#dde3ec] bg-white shadow-sm">
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setErrorMsg(null);
            }}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a5fa8]/10 text-[#1a5fa8]">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-base font-bold text-[#0f2137]">
                Agregar Usuario
              </span>
            </div>
            <svg
              className={`h-4 w-4 text-[#566778] transition-transform ${showForm ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="border-t border-[#dde3ec] px-6 pb-6 pt-5"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Tipo de acceso */}
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-[#566778] uppercase">
                    Tipo de Acceso
                  </label>
                  <div className="flex gap-3">
                    {(["email", "dominio"] as TipoAcceso[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, tipo: t, valor: "" }))
                        }
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
                          form.tipo === t
                            ? "border-[#1a5fa8] bg-[#1a5fa8]/5 text-[#1a5fa8]"
                            : "border-[#dde3ec] text-[#566778] hover:border-[#1a5fa8]/40"
                        }`}
                      >
                        {t === "email" ? (
                          <>
                            <span className="mr-1">✉</span> Correo exacto
                          </>
                        ) : (
                          <>
                            <span className="mr-1">@</span> Dominio completo
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-[#566778]/70">
                    {form.tipo === "email"
                      ? "Solo ese correo tendrá acceso. Ej: juan@empresa.com"
                      : "Todos los correos de ese dominio tendrán acceso. Ej: empresa.com"}
                  </p>
                </div>

                {/* Valor */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[#566778] uppercase">
                    {form.tipo === "email" ? "Correo electrónico" : "Dominio"}
                  </label>
                  <div className="flex items-center gap-0">
                    {form.tipo === "dominio" && (
                      <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-[#dde3ec] bg-[#f4f6fa] px-3 text-sm text-[#566778]">
                        @
                      </span>
                    )}
                    <input
                      type={form.tipo === "email" ? "email" : "text"}
                      placeholder={
                        form.tipo === "email"
                          ? "usuario@empresa.com"
                          : "empresa.com"
                      }
                      value={form.valor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, valor: e.target.value }))
                      }
                      className={`h-10 flex-1 border border-[#dde3ec] bg-white px-3 text-sm text-[#0f2137] outline-none transition-colors focus:border-[#1a5fa8] focus:ring-1 focus:ring-[#1a5fa8]/20 ${
                        form.tipo === "dominio"
                          ? "rounded-r-lg"
                          : "rounded-lg"
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Rol */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[#566778] uppercase">
                    Rol
                  </label>
                  <select
                    value={form.rol}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        rol: e.target.value as Rol,
                        id_cliente: null,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#dde3ec] bg-white px-3 text-sm text-[#0f2137] outline-none focus:border-[#1a5fa8] focus:ring-1 focus:ring-[#1a5fa8]/20"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {/* Cliente asociado (solo si rol = cliente) */}
                {form.rol === "cliente" && (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[#566778] uppercase">
                      Cliente asociado
                    </label>
                    <select
                      value={form.id_cliente ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          id_cliente: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-[#dde3ec] bg-white px-3 text-sm text-[#0f2137] outline-none focus:border-[#1a5fa8] focus:ring-1 focus:ring-[#1a5fa8]/20"
                      required
                    >
                      <option value="">— Selecciona un cliente —</option>
                      {clientes?.map((c) => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.nombre}
                          {c.codigo ? ` (${c.codigo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {errorMsg && (
                <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                    setErrorMsg(null);
                  }}
                  className="rounded-lg border border-[#dde3ec] px-5 py-2 text-sm font-semibold text-[#566778] transition-colors hover:bg-[#f4f6fa]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-[#1a5fa8] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1d6bbf] disabled:opacity-60"
                >
                  {createMutation.isPending ? "Guardando..." : "Agregar Usuario"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Users Table */}
        <div className="rounded-lg border border-[#dde3ec] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dde3ec] px-6 py-4">
            <h2 className="text-base font-bold text-[#0f2137]">
              Usuarios con acceso
            </h2>
            {!loadingUsuarios && (
              <span className="text-sm text-[#566778]">
                {usuarios?.filter((u) => u.activo === 1).length ?? 0} activos ·{" "}
                {usuarios?.length ?? 0} total
              </span>
            )}
          </div>

          {loadingUsuarios ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#1a5fa8] border-t-transparent" />
            </div>
          ) : !usuarios?.length ? (
            <div className="py-16 text-center text-sm text-[#566778]">
              No hay usuarios registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dde3ec] bg-[#f9fafc] text-xs font-semibold tracking-wider text-[#566778] uppercase">
                    <th className="px-6 py-3 text-left">Acceso</th>
                    <th className="px-6 py-3 text-left">Rol</th>
                    <th className="px-6 py-3 text-left">Cliente</th>
                    <th className="px-6 py-3 text-center">Estado</th>
                    <th className="px-6 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, _idx) => (
                    <tr
                      key={u.id}
                      className={`border-b border-[#dde3ec] transition-colors last:border-0 ${
                        u.activo === 0 ? "bg-[#f9fafc] opacity-60" : "hover:bg-[#f9fafc]"
                      }`}
                    >
                      {/* Acceso */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.email ? (
                            <>
                              <span className="rounded bg-[#eef1f6] px-1.5 py-0.5 font-mono text-xs text-[#566778]">
                                correo
                              </span>
                              <span className="font-medium text-[#0f2137]">
                                {u.email}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="rounded bg-[#f4f0ff] px-1.5 py-0.5 font-mono text-xs text-[#7c5cc4]">
                                dominio
                              </span>
                              <span className="font-medium text-[#0f2137]">
                                @{u.dominio}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <RolBadge rol={u.rol} />
                      </td>

                      {/* Cliente */}
                      <td className="px-6 py-4 text-[#566778]">
                        {u.clientes?.nombre ?? (
                          <span className="text-[#bcc5d0]">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            toggleMutation.mutate({ id: u.id })
                          }
                          disabled={toggleMutation.isPending}
                          title={
                            u.activo === 1 ? "Desactivar acceso" : "Activar acceso"
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                            u.activo === 1
                              ? "bg-[#1a9e5c]/10 text-[#1a9e5c] hover:bg-[#1a9e5c]/20"
                              : "bg-[#f4f6fa] text-[#bcc5d0] hover:bg-[#eef1f6]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.activo === 1 ? "bg-[#1a9e5c]" : "bg-[#bcc5d0]"
                            }`}
                          />
                          {u.activo === 1 ? "Activo" : "Inactivo"}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-center">
                        {deleteConfirm === u.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                deleteMutation.mutate({ id: u.id })
                              }
                              disabled={deleteMutation.isPending}
                              className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded border border-[#dde3ec] px-3 py-1 text-xs font-semibold text-[#566778] transition-colors hover:bg-[#f4f6fa]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(u.id)}
                            title="Eliminar usuario"
                            className="rounded p-1.5 text-[#bcc5d0] transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-[#d4860a]/20 bg-[#d4860a]/5 px-5 py-4">
          <p className="text-sm font-semibold text-[#d4860a]">
            ¿Cómo funciona el acceso?
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#d4860a]/80">
            <li>
              <strong>Correo exacto</strong> — solo ese usuario puede entrar
              (ej: juan@empresa.com)
            </li>
            <li>
              <strong>Dominio</strong> — cualquier correo con ese dominio puede
              entrar (ej: @empresa.com)
            </li>
            <li>
              Usuarios <strong>inactivos</strong> quedan en lista pero no pueden
              acceder al sistema
            </li>
            <li>
              Usuarios no registrados ven la pantalla de{" "}
              <strong>Acceso Denegado</strong> aunque tengan cuenta Auth0
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default function AdminUsuariosPage() {
  return (
    <RoleGuard requiredRole="super_admin">
      <UsuariosContent />
    </RoleGuard>
  );
}
