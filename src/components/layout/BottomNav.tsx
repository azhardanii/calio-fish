"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Gauge,
  TrendingUp,
  PackageCheck,
  Warehouse as WarehouseIcon,
  MoreHorizontal,
  X,
  Factory,
  Users,
  MapPin,
  Package,
  Network,
  Settings,
  MessageCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface BottomNavProps {
  user: { id: string; role: string; nama: string };
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";
  const isProduksi = isOwnerOrAdmin || role === "PRODUKSI" || role.includes("PRODUKSI");
  const isMarketing = isOwnerOrAdmin || role === "MARKETING" || role.includes("MARKETING");
  const isMitra = isOwnerOrAdmin || role === "MITRA" || role.includes("MITRA");

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on backdrop click
  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  // Primary nav items (shown directly in mobile bottom bar)
  const primaryItems = isOwnerOrAdmin
    ? [
        { name: "Home", href: "/overview", icon: Gauge },
        { name: "Marketing", href: "/marketing", icon: TrendingUp },
        { name: "Produksi", href: "/produksi", icon: Factory },
        { name: "Gudang", href: "/warehouse", icon: WarehouseIcon },
      ]
    : isProduksi
    ? [
        { name: "Home", href: "/overview", icon: Gauge },
        { name: "Produksi", href: "/produksi", icon: Factory },
        { name: "Chat", href: "/chats", icon: MessageCircle },
      ]
    : isMarketing
    ? [
        { name: "Home", href: "/overview", icon: Gauge },
        { name: "Marketing", href: "/marketing", icon: TrendingUp },
        { name: "Outlet", href: "/outlet", icon: MapPin },
      ]
    : isMitra
    ? [
        { name: "Home", href: "/overview", icon: Gauge },
        { name: "Outlet", href: "/outlet", icon: MapPin },
        { name: "Pengiriman", href: "/pengiriman", icon: Package },
      ]
    : [
        { name: "Home", href: "/overview", icon: Gauge },
      ];

  // Secondary items (shown in "More" drawer)
  const secondaryItems = [
    { name: "Produksi", href: "/produksi", icon: Factory, visible: isProduksi && !primaryItems.some(p => p.href === "/produksi") },
    { name: "Marketing", href: "/marketing", icon: TrendingUp, visible: isMarketing && !primaryItems.some(p => p.href === "/marketing") },
    { name: "Database Produk", href: "/produk", icon: PackageCheck, visible: isOwnerOrAdmin },
    { name: "Warehouse", href: "/warehouse", icon: WarehouseIcon, visible: isOwnerOrAdmin && !primaryItems.some(p => p.href === "/warehouse") },
    { name: "Karyawan", href: "/karyawan", icon: Users, visible: isOwnerOrAdmin },
    { name: "Database Outlet", href: "/outlet", icon: MapPin, visible: (isOwnerOrAdmin || isMitra || isMarketing) && !primaryItems.some(p => p.href === "/outlet") },
    { name: "Log Pengiriman", href: "/pengiriman", icon: Package, visible: (isOwnerOrAdmin || isMitra) && !primaryItems.some(p => p.href === "/pengiriman") },
    { name: "Affiliator", href: "/affiliator", icon: Network, visible: isOwnerOrAdmin },
    { name: "Chat Calio", href: "/chats", icon: MessageCircle, visible: !primaryItems.some(p => p.href === "/chats") },
    { name: "Pengaturan", href: "/settings", icon: Settings, visible: isOwnerOrAdmin },
  ].filter((item) => item.visible !== false);

  const handleLogout = () => {
    document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isMoreActive = secondaryItems.some((item) => isActive(item.href));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {primaryItems.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? "active" : ""}`}>
              <div className="bottom-nav-icon-wrap">
                <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {active && <div className="bottom-nav-indicator" />}
              </div>
              <span className="bottom-nav-label">{item.name}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          className={`bottom-nav-item ${isMoreActive || moreOpen ? "active" : ""}`}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <div className="bottom-nav-icon-wrap">
            <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.8} />
            {isMoreActive && <div className="bottom-nav-indicator" />}
          </div>
          <span className="bottom-nav-label">Lainnya</span>
        </button>
      </nav>

      {/* More Sheet Overlay */}
      {moreOpen && (
        <div className="more-sheet-overlay">
          <div className="more-sheet" ref={sheetRef}>
            {/* Handle bar */}
            <div className="more-sheet-handle">
              <div className="more-sheet-handle-bar" />
            </div>

            {/* Header */}
            <div className="more-sheet-header">
              <div className="more-sheet-title">Menu Lainnya</div>
              <button className="more-sheet-close" onClick={() => setMoreOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="more-sheet-menu">
              {secondaryItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`more-sheet-item ${active ? "active" : ""}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <div className={`more-sheet-item-icon ${active ? "active" : ""}`}>
                      <item.icon size={20} />
                    </div>
                    <span className="more-sheet-item-text">{item.name}</span>
                    <ChevronRight size={16} className="more-sheet-item-chevron" />
                  </Link>
                );
              })}
            </div>

            {/* User section */}
            <div className="more-sheet-user">
              <div className="more-sheet-user-info">
                <div className="more-sheet-avatar">
                  {user.nama.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="more-sheet-user-name">{user.nama}</div>
                  <div className="more-sheet-user-role">{user.role}</div>
                </div>
              </div>
              <button className="more-sheet-logout" onClick={handleLogout} type="button">
                <LogOut size={18} />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
