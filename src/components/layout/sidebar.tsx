"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  PackageCheck,
  WashingMachine,
  Factory,
  Users,
  Gift,
  Settings,
  MapPin,
  Package,
  Network,
  Gauge,
  Warehouse as WarehouseIcon,
  Store,
  LogOut
} from "lucide-react";

export function Sidebar({ user }: { user: { id: string; role: string; nama: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isProduksi = isOwnerOrAdmin || role === 'PRODUKSI' || role.includes('PRODUKSI');
  const isMarketing = isOwnerOrAdmin || role === 'MARKETING' || role.includes('MARKETING');
  const isMitra = isOwnerOrAdmin || role === 'MITRA' || role.includes('MITRA');
  const isDistributor = isOwnerOrAdmin || role === 'DISTRIBUTOR' || role.includes('DISTRIBUTOR');

  const navSections = [
    {
      title: "Dashboard",
      visible: isOwnerOrAdmin,
      items: [
        { name: "Overview", href: "/overview", icon: Gauge, visible: isOwnerOrAdmin },
      ]
    },
    {
      title: "Reporting",
      visible: isMarketing || isProduksi,
      items: [
        { name: "Marketing Offline", href: "/marketing", icon: TrendingUp, visible: isMarketing },
        { name: "E-Commerce", href: "/ecommerce", icon: ShoppingCart, visible: isMarketing || isOwnerOrAdmin },
        { name: "Event & Booth", href: "/booth", icon: Store, visible: isMarketing || isOwnerOrAdmin },
        { name: "Produksi", href: "/produksi", icon: Factory, visible: isProduksi },
      ]
    },
    {
      title: "Tim & Gudang",
      visible: isOwnerOrAdmin || isMitra || isMarketing || isProduksi || isDistributor,
      items: [
        { name: "Karyawan", href: "/karyawan", icon: Users, visible: isOwnerOrAdmin || isMarketing || isProduksi },
        { name: "Database Outlet", href: "/outlet", icon: MapPin, visible: isOwnerOrAdmin || isMitra || isMarketing || isDistributor },
        { name: "Database Produk", href: "/produk", icon: PackageCheck, visible: isOwnerOrAdmin },
        { name: "Warehouse", href: "/warehouse", icon: WarehouseIcon, visible: isOwnerOrAdmin || isProduksi || isMarketing || isDistributor },
        { name: "Log Pengiriman", href: "/pengiriman", icon: Package, visible: isOwnerOrAdmin || isMitra || isDistributor },
        { name: "Affiliator", href: "/affiliator", icon: Network, visible: isOwnerOrAdmin },
      ]
    },
    {
      title: "Pengaturan",
      visible: isOwnerOrAdmin,
      items: [
        { name: "Pengaturan", href: "/settings", icon: Settings, visible: isOwnerOrAdmin },
      ]
    }
  ];

  const handleLogout = async () => {
    // Delete cookie via an API route or server action, but for now we can just clear it and reload
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/login');
    router.refresh();
  };

  const homeHref = isOwnerOrAdmin 
    ? '/overview' 
    : role === 'MARKETING' || role.includes('MARKETING')
    ? '/marketing'
    : role === 'PRODUKSI' || role.includes('PRODUKSI')
    ? '/produksi'
    : role === 'DISTRIBUTOR' || role.includes('DISTRIBUTOR')
    ? '/warehouse'
    : role === 'MITRA' || role.includes('MITRA')
    ? '/outlet'
    : '/overview';

  return (
    <div className="sidebar flex flex-col h-full bg-white border-r">
      <div className="sb-logo px-4 py-5 border-b border-slate-100 flex items-center justify-center">
        <Link href={homeHref} className="flex items-center justify-center group no-underline" title="CalioFish Dashboard">
          <div className="p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs group-hover:scale-105 transition-transform duration-200 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="CalioFish - Cara Cerdas Makan Ikan" 
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl"
            />
          </div>
        </Link>
      </div>

      <nav className="sb-nav flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.filter(s => s.visible).map((section, idx) => (
          <div key={idx}>
            <div className="sb-section text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">{section.title}</div>
            <div className="space-y-1">
              {section.items.filter(i => i.visible).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link key={item.name} href={item.href} style={{ textDecoration: 'none' }}>
                    <div className={`sb-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                      <span className="sb-icon">
                        <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                      </span>
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sb-bottom m-4 p-3 rounded-xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <div className="sb-user flex items-center gap-2.5">
            <div className="avatar w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-sm">
              {user.nama.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col justify-center">
              <div className="sb-user-name font-bold text-[13px] text-slate-800 leading-none mb-1">{user.nama}</div>
              <div className="sb-user-role text-[11px] text-slate-500 font-medium leading-none">{user.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
