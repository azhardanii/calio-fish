"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Warehouse as WarehouseIcon
} from "lucide-react";

const navSections = [
  {
    title: "Dashboard",
    items: [
      { name: "Overview", href: "/overview", icon: Gauge },
    ]
  },
  {
    title: "Reporting",
    items: [
      { name: "Marketing", href: "/marketing", icon: TrendingUp },
      { name: "Produksi", href: "/produksi", icon: Factory },
    ]
  },
  {
    title: "Tim & Gudang",
    items: [
      { name: "Karyawan", href: "/karyawan", icon: Users },
      { name: "Database Outlet", href: "/outlet", icon: MapPin },
      { name: "Database Produk", href: "/produk", icon: PackageCheck },
      { name: "Warehouse", href: "/warehouse", icon: WarehouseIcon },
      { name: "Log Pengiriman", href: "/pengiriman", icon: Package },
      { name: "Affiliator", href: "/affiliator", icon: Network },
    ]
  },
  {
    title: "Pengaturan",
    items: [
      { name: "Pengaturan", href: "/settings", icon: Settings },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-mark">
          <div className="logo-icon">🐟</div>
          <div className="logo-text">Calio<span>Fish</span></div>
        </div>
      </div>

      <nav className="sb-nav">
        {navSections.map((section, idx) => (
          <div key={idx}>
            <div className="sb-section">{section.title}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link key={item.name} href={item.href} style={{ textDecoration: 'none' }}>
                  <div className={`sb-item ${isActive ? 'active' : ''}`}>
                    <span className="sb-icon">
                      <item.icon size={16} />
                    </span>
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-bottom">
        <div className="sb-user">
          <div className="avatar">OW</div>
          <div>
            <div className="sb-user-name">Owner User</div>
            <div className="sb-user-role">admin · realtime view</div>
          </div>
        </div>
      </div>
    </div>
  );
}
