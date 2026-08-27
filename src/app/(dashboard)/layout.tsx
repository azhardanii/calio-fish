import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { SWRProvider } from "@/components/SWRProvider";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || '';
  let role = headersList.get('x-user-role') || 'OWNER';
  
  if (userId) {
    const dbUser = await prisma.employee.findUnique({ where: { id: userId } });
    if (dbUser) {
      role = dbUser.role;
    }
  }

  const user = {
    id: userId,
    role: role,
    nama: headersList.get('x-user-nama') || 'User',
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
