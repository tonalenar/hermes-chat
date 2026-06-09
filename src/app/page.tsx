"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

const STORAGE_KEY = "hermes-chats";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

export default function Home() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load on mount
  useEffect(() => {
    setConvs(loadConversations());
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convs, activeId, loading]);

  const active = convs.find((c) => c.id === activeId) || null;

  const persist = useCallback((next: Conversation[]) => {
    setConvs(next);
    saveConversations(next);
  }, []);

  const newChat = () => {
    const c: Conversation = { id: crypto.randomUUID(), title: "New Chat", messages: [] };
    persist([c, ...convs]);
    setActiveId(c.id);
    setSidebarOpen(false);
    setInput("");
    textareaRef.current?.focus();
  };

  const deleteChat = (id: string) => {
    const next = convs.filter((c) => c.id !== id);
    persist(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "48px";

    // Ensure conversation exists
    let targetId = activeId;
    let currentConvs = [...convs];

    if (!targetId) {
      const c: Conversation = { id: crypto.randomUUID(), title: "New Chat", messages: [] };
      currentConvs = [c, ...currentConvs];
      targetId = c.id;
    }

    // Add user message
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    currentConvs = currentConvs.map((c) =>
      c.id === targetId
        ? {
            ...c,
            messages: [...c.messages, userMsg],
            title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
          }
        : c
    );
    persist(currentConvs);
    setActiveId(targetId);
    setLoading(true);

    try {
      // Get current conversation messages for context
      const currentConv = currentConvs.find((c) => c.id === targetId);
      const history = currentConv
        ? currentConv.messages.map((m) => ({ role: m.role, content: m.content }))
        : [];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          messages: [...history, { role: "user", content: text }],
        }),
      });

      const data = await res.json();
      const reply = data.response || `Error: ${data.error || "No response"}`;

      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply };
      const updated = loadConversations().map((c) =>
        c.id === targetId ? { ...c, messages: [...c.messages, assistantMsg] } : c
      );
      persist(updated);
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Connection error: ${err instanceof Error ? err.message : "Failed to reach server"}`,
      };
      const updated = loadConversations().map((c) =>
        c.id === targetId ? { ...c, messages: [...c.messages, errMsg] } : c
      );
      persist(updated);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "48px";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0b", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        style={{
          display: "none",
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 60,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: 8,
          color: "#fff",
          cursor: "pointer",
        }}
        className="mobile-menu-btn"
      >
        ☰
      </button>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 40,
          }}
          className="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: 280,
          minWidth: 280,
          background: "rgba(0,0,0,0.4)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        className={sidebarOpen ? "sidebar open" : "sidebar"}
      >
        {/* Header */}
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              H
            </div>
            <span style={{ fontWeight: 500, fontSize: 14, opacity: 0.9 }}>Hermes Chat</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ display: "none", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}
            className="sidebar-close-btn"
          >
            ✕
          </button>
        </div>

        {/* New Chat */}
        <div style={{ padding: 12 }}>
          <button
            onClick={newChat}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.8)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
          {convs.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 32 }}>No conversations yet</div>
          )}
          {convs.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setActiveId(c.id);
                setSidebarOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 4,
                background: activeId === c.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: activeId === c.id ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13,
                transition: "all 0.15s",
              }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title || "New Chat"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(c.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  padding: 4,
                  fontSize: 12,
                  opacity: 0.5,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          Hermes Agent v1.0
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        {/* Messages or Empty State */}
        {active && active.messages.length > 0 ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
            <div style={{ maxWidth: 672, margin: "0 auto" }}>
              {active.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 24,
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: "bold",
                      background:
                        msg.role === "user"
                          ? "rgba(255,255,255,0.1)"
                          : "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    }}
                  >
                    {msg.role === "user" ? "U" : "H"}
                  </div>
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "12px 16px",
                      borderRadius: 16,
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: msg.role === "user" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    H
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    Thinking
                    <span className="typing-dots">
                      <span>●</span>
                      <span>●</span>
                      <span>●</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 500,
                background: "linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.4))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 8,
              }}
            >
              How can I help today?
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Type a message and press Enter</p>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "0 16px 24px", position: "relative", zIndex: 10 }}>
          <div style={{ maxWidth: 672, margin: "0 auto" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px 16px 8px" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKey}
                  placeholder={active ? "Continue the conversation..." : "Ask Hermes a question..."}
                  disabled={loading}
                  rows={1}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 14,
                    resize: "none",
                    outline: "none",
                    minHeight: 48,
                    maxHeight: 200,
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div
                style={{
                  padding: "8px 16px 16px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                    background: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.05)",
                    color: input.trim() && !loading ? "#0a0a0b" : "rgba(255,255,255,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  {loading ? "⏳" : "↑"} {loading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>

            {/* Quick actions */}
            {!loading && (!active || active.messages.length === 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
                {[
                  { label: "Analyze", prompt: "Analyze the following and provide insights: " },
                  { label: "Create", prompt: "Create a detailed plan for: " },
                  { label: "Debug", prompt: "Debug this issue and find the root cause: " },
                  { label: "Explain", prompt: "Explain in detail: " },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={() => {
                      setInput(a.prompt);
                      textareaRef.current?.focus();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 8,
                      color: "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      fontSize: 13,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 1023px) {
          .mobile-menu-btn { display: block !important; }
          .sidebar { position: fixed; z-index: 50; height: 100%; transform: translateX(-100%); transition: transform 0.3s ease; }
          .sidebar.open { transform: translateX(0); }
          .sidebar-close-btn { display: block !important; }
        }
        @media (min-width: 1024px) {
          .sidebar-overlay { display: none !important; }
        }
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .typing-dots span {
          display: inline-block;
          margin: 0 2px;
          animation: blink 1.4s infinite;
          font-size: 8px;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}
