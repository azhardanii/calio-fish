"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

export function ChatFloatingButton() {
  const pathname = usePathname();

  if (pathname === "/chats") {
    return null;
  }

  return (
    <Link
      href="/chats"
      className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 z-50 flex items-center justify-center"
      title="Calio Chat"
    >
      <MessageCircle size={28} />
    </Link>
  );
}
