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
      className="chat-fab"
      title="Calio Chat"
    >
      <MessageCircle size={24} />
    </Link>
  );
}
