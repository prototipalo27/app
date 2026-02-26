"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markConversationAsRead, startNewConversation } from "./actions";

type Conversation = {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  contact_phone: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  instance_id: string;
};

type Message = {
  id: string;
  conversation_id: string;
  remote_jid: string;
  from_me: boolean;
  content: string | null;
  message_type: string;
  status: string;
  timestamp: string;
};

export default function WhatsAppChat({
  initialConversations,
  instanceConnected,
}: {
  initialConversations: Conversation[];
  instanceConnected: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newText, setNewText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newFirstMessage, setNewFirstMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  // Mobile: track whether we're viewing a chat
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId);

  // Keep ref in sync
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedId) return;

    setLoadingMessages(true);
    const supabase = createClient();

    supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", selectedId)
      .order("timestamp", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setMessages(data || []);
        setLoadingMessages(false);
      });

    // Mark as read (fire-and-forget, no revalidation needed)
    markConversationAsRead(selectedId);
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, unread_count: 0 } : c))
    );
  }, [selectedId]);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Single global realtime subscription (never depends on selectedId)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("whatsapp-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // Add to current chat if it matches the selected conversation
          if (newMsg.conversation_id === selectedIdRef.current) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              // Remove optimistic message if real one arrived
              const filtered = prev.filter(
                (m) => !m.id.startsWith("temp-") || m.content !== newMsg.content
              );
              return [...filtered, newMsg];
            });
            // Auto-mark as read
            if (!newMsg.from_me) {
              markConversationAsRead(newMsg.conversation_id);
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === newMsg.conversation_id
                    ? { ...c, unread_count: 0 }
                    : c
                )
              );
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const newConv = payload.new as Conversation;
          setConversations((prev) => {
            if (prev.some((c) => c.id === newConv.id)) return prev;
            return [newConv, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const updated = payload.new as Conversation;
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            let next: Conversation[];
            if (exists) {
              next = prev.map((c) =>
                c.id === updated.id
                  ? {
                      ...c,
                      ...updated,
                      // Don't overwrite unread_count if we're viewing this chat
                      unread_count:
                        c.id === selectedIdRef.current
                          ? 0
                          : updated.unread_count,
                    }
                  : c
              );
            } else {
              next = [updated, ...prev];
            }
            // Sort by last message
            return next.sort(
              (a, b) =>
                new Date(b.last_message_at || 0).getTime() -
                new Date(a.last_message_at || 0).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Empty deps — single global subscription

  const handleSend = () => {
    if (!newText.trim() || !selected || !instanceConnected) return;
    const text = newText;
    setNewText("");

    // Optimistic: add message locally
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selected.id,
      remote_jid: selected.remote_jid,
      from_me: true,
      content: text,
      message_type: "text",
      status: "pending",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const result = await sendMessage(
        selected.id,
        selected.contact_phone || selected.remote_jid.replace("@s.whatsapp.net", ""),
        text
      );
      if (!result.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...m, status: "failed" } : m
          )
        );
      }
    });
  };

  const handleNewConversation = () => {
    if (!newPhone.trim() || !newFirstMessage.trim()) return;

    startTransition(async () => {
      const result = await startNewConversation(newPhone, newFirstMessage);
      if (result.success && result.conversationId) {
        setSelectedId(result.conversationId);
        setMobileShowChat(true);
        setShowNewChat(false);
        setNewPhone("");
        setNewFirstMessage("");
      }
    });
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileShowChat(true);
    setShowNewChat(false);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_phone?.includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  });

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Conversation list */}
      <div
        className={`flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 md:w-80 md:shrink-0 ${
          mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Search + new chat button */}
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white">
              {totalUnread}
            </span>
          )}
          <button
            onClick={() => {
              setShowNewChat(true);
              setMobileShowChat(true);
            }}
            className="rounded-lg bg-green-600 p-1.5 text-white hover:bg-green-700"
            title="Nueva conversación"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-zinc-500">
              No hay conversaciones
            </p>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors dark:border-zinc-800 ${
                  selectedId === conv.id
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                  {(conv.contact_name || conv.contact_phone || "?")?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-sm ${conv.unread_count > 0 ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-900 dark:text-white"}`}>
                      {conv.contact_name || conv.contact_phone || "Desconocido"}
                    </p>
                    {conv.last_message_at && (
                      <span className={`shrink-0 text-[11px] ${conv.unread_count > 0 ? "font-semibold text-green-600" : "text-zinc-400"}`}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-xs ${conv.unread_count > 0 ? "font-medium text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {conv.last_message_preview || "Sin mensajes"}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={`flex flex-1 flex-col ${
          !mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        {showNewChat ? (
          /* New conversation form */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
            <button
              onClick={handleBackToList}
              className="self-start text-sm text-zinc-500 hover:text-zinc-700 md:hidden dark:text-zinc-400"
            >
              &larr; Volver
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Nueva conversación
            </h2>
            <input
              type="tel"
              placeholder="Número de teléfono (ej: 34612345678)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <textarea
              placeholder="Primer mensaje..."
              value={newFirstMessage}
              onChange={(e) => setNewFirstMessage(e.target.value)}
              rows={3}
              className="w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewChat(false);
                  setMobileShowChat(false);
                }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleNewConversation}
                disabled={isPending || !newPhone.trim() || !newFirstMessage.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        ) : selected ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <button
                onClick={handleBackToList}
                className="text-zinc-500 hover:text-zinc-700 md:hidden dark:text-zinc-400"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                {(selected.contact_name || selected.contact_phone || "?")?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {selected.contact_name || selected.contact_phone || "Desconocido"}
                </p>
                <p className="text-xs text-zinc-500">
                  +{selected.contact_phone}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-950">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <svg className="h-6 w-6 animate-spin text-green-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">
                  No hay mensajes
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from_me ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 md:max-w-[70%] ${
                          msg.from_me
                            ? "rounded-br-md bg-green-600 text-white"
                            : "rounded-bl-md bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">
                          {msg.content || `[${msg.message_type}]`}
                        </p>
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            msg.from_me
                              ? "text-green-200"
                              : "text-zinc-400"
                          }`}
                        >
                          <span>{formatTime(msg.timestamp)}</span>
                          {msg.from_me && (
                            <span>
                              {msg.status === "read"
                                ? "✓✓"
                                : msg.status === "delivered"
                                  ? "✓✓"
                                  : msg.status === "failed"
                                    ? "✗"
                                    : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {!instanceConnected ? (
                <p className="text-center text-sm text-red-500">
                  WhatsApp no está conectado. Ve a Configuración para conectar.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isPending || !newText.trim()}
                    className="rounded-xl bg-green-600 p-2.5 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-400">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">
              Selecciona una conversación para empezar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) {
    return date.toLocaleDateString("es-ES", { weekday: "short" });
  }
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
