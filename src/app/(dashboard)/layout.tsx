import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { SWRProvider } from "@/components/SWRProvider";
import { headers } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const user = {
    id: headersList.get('x-user-id') || '',
    role: headersList.get('x-user-role') || 'OWNER',
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
