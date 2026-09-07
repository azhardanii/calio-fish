import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { BottomNav } from "@/components/layout/BottomNav";
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
    select: { id: true, nama: true, role: true, posisi: true }
  });

  let role = (dbUser?.role || session.role || 'STAFF').toUpperCase();
  const posisi = (dbUser?.posisi || '').toUpperCase();

  if (role === 'STAFF PRODUKSI' || role === 'STAFF_PRODUKSI' || role.includes('PRODUKSI') || posisi.includes('PRODUKSI')) {
    role = 'PRODUKSI';
  } else if (role === 'STAFF MARKETING' || role === 'STAFF_MARKETING' || role.includes('MARKETING') || posisi.includes('MARKETING')) {
    role = 'MARKETING';
  } else if (role.includes('DISTRIBUTOR') || posisi.includes('DISTRIBUTOR')) {
    role = 'DISTRIBUTOR';
  } else if (role.includes('MITRA') || posisi.includes('MITRA')) {
    role = 'MITRA';
  } else if (role.includes('ADMIN') || posisi.includes('ADMIN')) {
    role = 'ADMIN';
  } else if (role.includes('OWNER') || posisi.includes('OWNER')) {
    role = 'OWNER';
  }

  const user = {
    id: dbUser?.id || session.id,
    role: role,
    nama: dbUser?.nama || session.nama || 'User',
  };

  return (
    <SWRProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
        <Sidebar user={user} />
        <div className="main">
          <Header user={user} />
          <main className="content mobile-content">
            {children}
          </main>
        </div>
        <ChatFloatingButton />
        <BottomNav user={user} />
      </div>
    </SWRProvider>
  );
}

