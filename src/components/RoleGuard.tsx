"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "~/trpc/react";

type Role = "super_admin" | "cliente";

export function RoleGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: Role;
}) {
  const router = useRouter();
  const { data: me, isLoading } = api.auth.getMe.useQuery();

  useEffect(() => {
    if (isLoading) return;
    if (me === null) {
      router.replace("/no-autorizado");
      return;
    }
    if (requiredRole && me?.rol !== requiredRole) {
      router.replace("/home");
    }
  }, [isLoading, me, requiredRole, router]);

  if (isLoading || me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef1f6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a5fa8] border-t-transparent" />
      </div>
    );
  }

  if (me === null) return null;
  if (requiredRole && me.rol !== requiredRole) return null;

  return <>{children}</>;
}
