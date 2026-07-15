import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatFloatingButton } from "@/components/layout/ChatFloatingButton";
import { SWRProvider } from "@/components/SWRProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
        <Sidebar />
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
