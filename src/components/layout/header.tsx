"use client";
import Link from "next/link";
import { Bell, Moon } from "lucide-react";
import { usePathname } from "next/navigation";

interface HeaderProps {
  user?: { id: string; role: string; nama: string };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const homeHref = isOwnerOrAdmin 
    ? '/overview' 
    : role === 'MARKETING' || role.includes('MARKETING')
    ? '/marketing'
    : role === 'PRODUKSI' || role.includes('PRODUKSI')
    ? '/produksi'
    : role === 'MITRA' || role.includes('MITRA')
    ? '/outlet'
    : '/overview';

  // Format pathname to display as Title
  const paths = pathname.split('/').filter(Boolean);
  const title = paths.length > 0 ? paths[paths.length - 1] : "Dashboard";
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1).replace('-', ' ');

  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Mobile brand - visible only on mobile */}
        <div className="mobile-brand">
          <Link href={homeHref} className="flex items-center no-underline" title="CalioFish Dashboard">
            <div className="p-0.5 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="CalioFish" 
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-lg"
              />
            </div>
          </Link>
        </div>
        {/* Desktop title */}
        <div className="topbar-title-group">
          <div className="page-title">{formattedTitle}</div>
          <div className="page-crumb">CalioFish / {formattedTitle}</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="tb-btn tb-notif">
          <Bell size={16} />
          <span className="notif-dot"></span>
        </div>
        <div className="tb-btn">
          <Moon size={16} />
        </div>
      </div>
    </div>
  );
}
