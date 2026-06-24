"use client";
import { Bell, Moon } from "lucide-react";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  
  // Format pathname to display as Title
  const paths = pathname.split('/').filter(Boolean);
  const title = paths.length > 0 ? paths[paths.length - 1] : "Dashboard";
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1).replace('-', ' ');

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div>
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
