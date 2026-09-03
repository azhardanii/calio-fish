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
  ChevronDown,
  ChevronUp,
  Compass,
  Store,
} from "lucide-react";

interface BottomNavProps {
  user: { id: string; role: string; nama: string };
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";
  const isProduksi = isOwnerOrAdmin || role === "PRODUKSI" || role.includes("PRODUKSI");
  const isMarketing = isOwnerOrAdmin || role === "MARKETING" || role.includes("MARKETING");
  const isMitra = isOwnerOrAdmin || role === "MITRA" || role.includes("MITRA");

  // Scroll detection: auto-hide on scroll down, auto-show on scroll up
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = (e.target === document ? document.documentElement : e.target) as HTMLElement;
      const currentScrollY = target.scrollTop || window.scrollY || 0;
      const diff = currentScrollY - lastScrollY.current;

      if (Math.abs(diff) > 15) {
        if (diff > 0 && currentScrollY > 80) {
          // Scrolling down -> hide nav
          setIsOpen(false);
        } else if (diff < 0) {
          // Scrolling up -> show nav
          setIsOpen(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const contentEl = document.querySelector(".content");
    if (contentEl) {
      contentEl.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (contentEl) {
        contentEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  // Auto-hide when form inputs are focused (prevents virtual keyboard overlap with save button)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        setIsInputFocused(true);
      }
    };

    const onFocusOut = () => {
      setTimeout(() => {
        const activeTag = (document.activeElement as HTMLElement)?.tagName;
        if (activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
          setIsInputFocused(false);
        }
      }, 150);
    };

    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Auto-hide when ANY modal dialog is open in the DOM
  useEffect(() => {
    const checkModals = () => {
      const modals = document.querySelectorAll(
        '.fixed.inset-0:not(.more-sheet-overlay)'
      );
      setIsModalOpen(modals.length > 0);
    };

    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // Reset state on route change
  useEffect(() => {
    setMoreOpen(false);
    setIsOpen(true);
    setIsInputFocused(false);
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
        { name: "Gudang", href: "/warehouse", icon: WarehouseIcon },
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
    { name: "Event & Booth", href: "/booth", icon: Store, visible: (isMarketing || isOwnerOrAdmin) && !primaryItems.some(p => p.href === "/booth") },
    { name: "Database Produk", href: "/produk", icon: PackageCheck, visible: isOwnerOrAdmin },
    { name: "Warehouse", href: "/warehouse", icon: WarehouseIcon, visible: (isOwnerOrAdmin || isProduksi) && !primaryItems.some(p => p.href === "/warehouse") },
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

  // Determine whether to display the bottom navigation bar
  const shouldShow = (isOpen && !isModalOpen && !isInputFocused) || moreOpen;

  return (
    <>
      {/* Floating Reopen Pill when BottomNav is hidden (Only shown when not in a modal, strictly on mobile) */}
      {!shouldShow && !isModalOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
            setIsInputFocused(false);
          }}
          className="bottom-nav-reopen md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/95 hover:bg-slate-900 text-white backdrop-blur-md rounded-full px-4 py-2 shadow-xl border border-white/20 text-xs font-bold items-center gap-2 cursor-pointer transition-all active:scale-95 animate-in fade-in select-none pointer-events-auto"
          title="Buka Menu Navigasi"
        >
          <Compass size={15} className="text-cyan-400" />
          <span>Buka Menu</span>
          <ChevronUp size={14} className="text-slate-300" />
        </button>
      )}

      {/* Bottom Navigation Bar */}
      <nav 
        className={`bottom-nav ${shouldShow ? "" : "nav-hidden"}`} 
        aria-label="Mobile navigation"
      >
        {/* Toggle Minimize Handle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
          }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/90 border-b-0 rounded-t-lg px-3 py-0.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 pointer-events-auto"
          title="Tutup Menu Navigasi"
        >
          <ChevronDown size={13} className="text-slate-500" />
          <span>Tutup</span>
        </button>
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
