"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare, Plus, Trash2, Send, Copy, Check, Menu, X,
  Sparkles, Code, Bug, BookOpen, Paperclip, FileText, ImageIcon,
  ChevronDown, Bot,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// Markdown renderer
function renderMarkdown(text: string) {
  const blocks: Array<{ type: "code"; lang: string; content: string } | { type: "text"; content: string }> = [];
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: "code", lang: match[1] || "text", content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    blocks.push({ type: "text", content: text.slice(lastIndex) });
  }

  return blocks;
}

function InlineMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-emerald-400">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, "<br/>");

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-zinc-300">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const blocks = renderMarkdown(content);
  return (
    <div className="prose-invert max-w-none leading-relaxed">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} lang={block.lang} content={block.content} />
        ) : (
          <InlineMarkdown key={i} text={block.content} />
        )
      )}
    </div>
  );
}

const quickActions = [
  { icon: Sparkles, label: "Analyze", prompt: "Analyze this: " },
  { icon: Code, label: "Create", prompt: "Create: " },
  { icon: Bug, label: "Debug", prompt: "Debug this issue: " },
  { icon: BookOpen, label: "Explain", prompt: "Explain: " },
];

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("kr/auto");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const availableModels = [
    { id: "kr/auto", name: "Auto Select", desc: "9Router escolhe o melhor" },
    { id: "kr/claude-opus-4.8", name: "Claude Opus 4.8", desc: "Premium coding" },
    { id: "kr/claude-opus-4.8-thinking", name: "Claude Opus 4.8 Thinking", desc: "Com reasoning" },
    { id: "kr/claude-sonnet-4.6", name: "Claude Sonnet 4.6", desc: "Balanced" },
    { id: "kr/claude-sonnet-4.5", name: "Claude Sonnet 4.5", desc: "Economico" },
    { id: "kr/claude-haiku-4.5", name: "Claude Haiku 4.5", desc: "Rapido" },
    { id: "kr/deepseek-3.2", name: "DeepSeek 3.2", desc: "Open source" },
    { id: "kr/minimax-m2.5", name: "MiniMax M2.5", desc: "Novo" },
    { id: "nvidia/minimaxai/minimax-m2.7", name: "MiniMax M2.7 (NVIDIA)", desc: "Gratuito" },
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // Load from Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (data && data.length > 0) {
          const convs: Conversation[] = data.map((c: any) => ({
            id: c.id,
            title: c.title,
            messages: [],
            createdAt: new Date(c.created_at).getTime(),
          }));
          setConversations(convs);
          setActiveId(convs[0].id);
        }
      } catch (e) {
        console.error("Error loading conversations:", e);
      }
    }
    loadFromSupabase();
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  const newChat = useCallback(() => {
    const id = crypto.randomUUID();
    const conv: Conversation = { id, title: "New Chat", messages: [], createdAt: Date.now() };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const deleteChat = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      localStorage.setItem("hermes-conversations", JSON.stringify(next));
      return next;
    });
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setFiles((prev) => [...prev, ...selected].slice(0, 5));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon size={14} />;
    return <FileText size={14} />;
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg && files.length === 0) return;
    if (isStreaming) return;

    const filesToSend = [...files];
    setFiles([]);

    let convId = activeId;
    if (!convId) {
      const id = crypto.randomUUID();
      const title = msg.slice(0, 40) || (filesToSend.length > 0 ? `Arquivo(s) (${filesToSend.length})` : "New Chat");
      const conv: Conversation = { id, title, messages: [], createdAt: Date.now() };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(id);
      convId = id;
    }

    const displayContent = msg || (filesToSend.length > 0 ? `[Arquivo(s) enviado(s): ${filesToSend.map(f => f.name).join(", ")}]` : "");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: displayContent };
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const updated = { ...c, messages: [...c.messages, userMsg] };
        if (c.messages.length === 0) updated.title = msg.slice(0, 40) || "Arquivo(s)";
        return updated;
      })
    );
    setInput("");
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "" }] }
          : c
      )
    );

    try {
      const messagesForApi = activeConversation?.messages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      })) || [];

      let res;
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", msg);
        formData.append("messages", JSON.stringify(messagesForApi));
        formData.append("conversationId", convId);
        formData.append("model", selectedModel);
        filesToSend.forEach((f) => formData.append("files", f));

        res = await fetch("/api/chat", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, conversationId: convId, messages: messagesForApi, model: selectedModel }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Request failed");
      }

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                          ),
                        }
                      : c
                  )
                );
              }
            } catch { /* skip */ }
          }
        }
      } else {
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: data.response } : m
                  ),
                }
              : c
          )
        );
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "An error occurred";
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: `Error: ${errMsg}` } : m
                ),
              }
            : c
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, activeId, activeConversation?.messages, files]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:relative z-50 md:z-auto h-full w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100">Hermes Chat</h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>
        <div className="p-3">
          <button onClick={newChat} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors">
            <Plus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
              onClick={() => { setActiveId(c.id); setSidebarOpen(false); }}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="flex-1 text-sm truncate">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 gap-3 bg-zinc-950/80 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-zinc-400 hover:text-zinc-200">
            <Menu size={20} />
          </button>
          
          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
            >
              <Bot size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">{availableModels.find(m => m.id === selectedModel)?.name || selectedModel}</span>
              <ChevronDown size={14} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model.id); setModelDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors ${selectedModel === model.id ? 'bg-zinc-800' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-200">{model.name}</span>
                        {selectedModel === model.id && <Check size={14} className="text-emerald-400" />}
                      </div>
                      <span className="text-xs text-zinc-500">{model.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <h2 className="text-sm font-medium text-zinc-300 truncate">
            {activeConversation?.title || "Hermes Chat"}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">How can I help?</h2>
              <p className="text-zinc-400 mb-8 text-center max-w-md">Start a conversation or try one of the quick actions below.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg w-full">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { setInput(action.prompt); textareaRef.current?.focus(); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all text-zinc-300 hover:text-zinc-100"
                  >
                    <action.icon size={20} />
                    <span className="text-xs font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
              {activeConversation.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles size={14} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "bg-zinc-800 rounded-2xl rounded-br-md px-4 py-3 text-zinc-100" : "text-zinc-200"}`}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    ) : msg.content ? (
                      <MessageContent content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-1.5 py-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 p-4 bg-zinc-950/80 backdrop-blur">
          <div className="max-w-3xl mx-auto relative">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs">
                    {getFileIcon(file)}
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="text-zinc-500 hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Hermes..."
              rows={1}
              className="w-full resize-none rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 pr-24 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all max-h-40 overflow-y-auto"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() && files.length === 0 || isStreaming}
                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 transition-colors text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-zinc-600 mt-2">Hermes can make mistakes. Verify important information.</p>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.pdf,.doc,.docx,.xls,.xlsx,.zip"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
