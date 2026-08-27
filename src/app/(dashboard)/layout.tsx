import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { SWRProvider } from "@/components/SWRProvider";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

import { verifySession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  
  const user = {
    id: session?.id || '',
    role: session?.role?.toUpperCase() || 'OWNER',
    nama: session?.nama || 'User',
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
