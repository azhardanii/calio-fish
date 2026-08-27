import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { SWRProvider } from "@/components/SWRProvider";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

// Force this layout to never be cached so role changes in Supabase are
// immediately reflected without requiring users to log out/in.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  if (!session?.id) return null; // Middleware handles redirect

  // Always fetch the freshest data directly from the database.
  // This ensures role changes in Supabase are instantly reflected in the app.
  const dbUser = await prisma.employee.findUnique({
    where: { id: session.id },
    select: { id: true, nama: true, role: true }
  });

  const user = {
    id: dbUser?.id || session.id,
    role: (dbUser?.role || session.role || 'STAFF').toUpperCase(),
    nama: dbUser?.nama || session.nama || 'User',
  };

  return (
    <SWRProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
        <Sidebar user={user} />
        <div className="main">
          <Header />
          <main className="content">
            {children}
          </main>
        </div>
        <ChatFloatingButton />
      </div>
    </SWRProvider>
  );
}
