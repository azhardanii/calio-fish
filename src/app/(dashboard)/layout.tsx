import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AutoRefresh } from "@/components/AutoRefresh";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <div className="main">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:px-7 lg:py-6">
          <AutoRefresh intervalMs={30000} />
          {children}
        </main>
      </div>
    </div>
  );
}
