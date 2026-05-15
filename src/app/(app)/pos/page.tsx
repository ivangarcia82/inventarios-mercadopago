// src/app/(app)/pos/page.tsx
import { auth } from "@/lib/auth";
import { getAllWarehouses, getWarehouses } from "@/app/actions/warehouses";
import { PosTerminal } from "@/components/pos/pos-terminal";

export default async function PosPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;

  const warehousesRes = userRole === "ADMIN_MP"
    ? await getAllWarehouses()
    : await getWarehouses(userOrgId);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Solicitud rápida</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Crea una solicitud que arranca directamente en preparación — descuenta inventario al instante y genera la remisión.
        </p>
      </div>
      <PosTerminal
        warehouses={warehousesRes.success ? (warehousesRes.data as any) : []}
      />
    </div>
  );
}
