// src/app/(app)/requests/new/page.tsx
import { auth } from "@/lib/auth";
import { getWarehouses, getAllWarehouses } from "@/app/actions/warehouses";
import { NewRequestForm } from "@/components/requests/new-request-form";

export default async function NewRequestPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const isAdmin = userRole === "ADMIN_MP";

  const res = isAdmin ? await getAllWarehouses() : await getWarehouses();
  const warehouses = res.success ? res.data : [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Nueva solicitud de material</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Elige los productos, el método de entrega y envía la solicitud.
        </p>
      </div>
      <NewRequestForm warehouses={warehouses as any} isAdmin={isAdmin} />
    </div>
  );
}
