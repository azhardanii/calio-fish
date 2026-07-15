"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  status?: "sending" | "success" | "error";
  parsedData?: any;
};

export default function ChatTesterPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const payload = {
        event: "message",
        device_id: "test_device",
        payload: {
          id: userMsg.id,
          from: "081234567890",
          chat_id: "TEST_CHAT_ID",
          body: userMsg.content,
          from_name: "Admin Tester",
          is_from_me: false,
          timestamp: Math.floor(Date.now() / 1000).toString(),
        },
      };

      const res = await fetch("/api/webhook/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      let botReply = "";
      if (data.status === "success") {
        botReply = data.replyMsg || "Pesan berhasil diproses.";
      } else if (data.status === "ignored") {
        botReply = `⚠️ Pesan diabaikan: ${data.reason}`;
      } else if (data.status === "clarified") {
        botReply = data.clarification_message || `⚠️ *Laporan Kurang Jelas*\nSilakan perjelas input Anda.`;
      } else {
        botReply = `❌ Terjadi kesalahan sistem: ${data.message || data.reason || "Unknown error"}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_bot",
          role: "bot",
          content: botReply,
          timestamp: new Date(),
          parsedData: data.parsedData,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_error",
          role: "bot",
          content: `❌ Gagal menghubungi server: ${error.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm mx-auto w-full max-w-4xl">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl">
            <Bot className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg">Calio Chat</h1>
            <p className="text-xs text-gray-500 font-medium">Asisten sistem operasional Calio Fish</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-md text-center">
              <Bot size={48} className="mb-4 text-blue-300" />
              <h3 className="font-bold text-gray-700 mb-2">Halo! dengan asisten sistem Calio disini.</h3>
              <p className="text-sm">Silakan ketik laporan harian dan sistem akan membantu mencatatnya secara otomatis.</p>
              <div className="bg-gray-50 p-3 rounded-lg w-full mt-4 text-left text-xs border border-gray-200">
                <span className="font-semibold block mb-1">Contoh Input:</span>
                <code className="text-blue-600">marketing offline hari ini 250rb</code>
                <br />
                <code className="text-blue-600">paket kiriman e-commerce shopee 100 fs ori</code>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className="flex items-end gap-2 max-w-[85%]">
              {msg.role === "bot" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-1">
                  <Bot size={16} className="text-blue-600" />
                </div>
              )}
              <div
                className={`px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                  }`}
              >
                {msg.content}
              </div>
            </div>

            <div className={`flex flex-col gap-1 mt-1 ${msg.role === "user" ? "items-end" : "items-start"} ${msg.role === "bot" ? "ml-10" : ""}`}>
              <span className="text-[10px] text-gray-400 font-medium">
                {format(msg.timestamp, "HH:mm")} {msg.role === "user" && "• Terkirim"}
              </span>
              {msg.parsedData && (
                <details className="text-[10px] text-gray-500 cursor-pointer group">
                  <summary className="hover:text-blue-500 transition-colors">Lihat Data Parsed JSON</summary>
                  <pre className="bg-gray-800 text-green-400 p-3 rounded-lg mt-1 overflow-x-auto max-w-lg shadow-inner">
                    {JSON.stringify(msg.parsedData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-end gap-2 text-gray-500">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-white border border-gray-200 px-4 py-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5 h-11 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik laporan Anda di sini..."
            className="flex-1 bg-gray-100 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white px-6 rounded-xl flex items-center justify-center transition-colors shadow-sm"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
