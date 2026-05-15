// src/app/(app)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import prisma from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userRole = (session.user as any).role as string;
  const orgId = (session.user as any).organizationId as string;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          userName={session.user.name ?? "Usuario"}
          userRole={userRole}
          orgName={org?.name ?? ""}
        />
        <main className="flex-1 overflow-y-auto bg-slate-100 px-8 py-8">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
