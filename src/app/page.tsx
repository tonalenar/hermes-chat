"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare, Plus, Trash2, Send, Copy, Check, Menu, X,
  Sparkles, Code, Bug, BookOpen, Paperclip, FileText, ImageIcon,
  ChevronDown, Bot, Square, RotateCcw, Pencil, Download, Sun, Moon,
  Settings, Search, LogIn, LogOut, User, Sliders,
} from "lucide-react";
import { useSupabase } from "@/lib/supabase-context";
import clsx from "clsx";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return "agora";
  if (diffSec < 60) return `há ${diffSec} seg`;
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHour < 24) return `há ${diffHour} h`;
  if (diffDay < 7) {
    if (diffDay === 1) return "ontem às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `há ${diffDay} dias`;
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Settings from localStorage
interface AppSettings {
  theme: "dark" | "light";
  temperature: number;
  systemInstructions: string;
}

const defaultSettings: AppSettings = {
  theme: "dark",
  temperature: 0.7,
  systemInstructions: "",
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem("hermes-settings");
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaultSettings;
}

export default function Home() {
  const { user, loading: authLoading, signInWithGithub, signOut } = useSupabase();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("kr/auto");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

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
    { id: "oc/deepseek-v4-flash-free", name: "DeepSeek V4 Flash (Free)", desc: "OpenCode gratuito" },
    { id: "oc/mimo-v2.5-free", name: "Mimo V2.5 (Free)", desc: "OpenCode gratuito" },
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // Theme helper
  const theme = settings.theme;

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    }
  }, [settings.theme]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("hermes-settings", JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [settings]);

  // Build image previews when files change
  useEffect(() => {
    const urls = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // Load conversations from Supabase on mount
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (user?.id) params.set("user_id", user.id);
        const res = await fetch(`/api/conversations?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.conversations && data.conversations.length > 0) {
          const convs: Conversation[] = data.conversations.map((c: any) => ({
            id: c.id,
            title: c.title || "New Chat",
            messages: [],
            createdAt: new Date(c.created_at).getTime(),
          }));
          setConversations(convs);
        }
      } catch (e) {
        console.error("Error loading conversations:", e);
      }
    }
    loadFromSupabase();
  }, [user?.id]);  // Re-load when user changes

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeId) return;
    const conv = conversations.find((c) => c.id === activeId);
    if (conv && conv.messages.length > 0) return;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/conversations/${activeId}`);
        if (!res.ok) return;
        const data = await res.json();
        const msgs: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at || m.createdAt).getTime(),
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, messages: msgs } : c
          )
        );
      } catch (e) {
        console.error("Error loading messages:", e);
      }
    }
    loadMessages();
  }, [activeId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape: close modals/dropdowns
      if (e.key === "Escape") {
        if (fullscreenImage) { setFullscreenImage(null); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (modelDropdownOpen) { setModelDropdownOpen(false); return; }
        if (exportDropdownOpen) { setExportDropdownOpen(false); return; }
        if (editingMessageId) { setEditingMessageId(null); return; }
        if (editingTitle) { setEditingTitle(null); return; }
        if (sidebarSearch) { setSidebarSearch(""); return; }
      }

      // Ctrl+K: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!sidebarOpen) setSidebarOpen(true);
        // Focus search after sidebar opens
        setTimeout(() => sidebarSearchRef.current?.focus(), 100);
        return;
      }

      // Ctrl+Shift+N: new conversation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        newChat();
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [sidebarOpen, settingsOpen, modelDropdownOpen, exportDropdownOpen, editingMessageId, editingTitle, sidebarSearch, fullscreenImage]);

  const newChat = useCallback(() => {
    const id = crypto.randomUUID();
    const conv: Conversation = { id, title: "New Chat", messages: [], createdAt: Date.now() };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
    setInput("");
    setFiles([]);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next;
    });
    if (activeId === id) setActiveId(null);
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
  }, [activeId]);

  // Rename conversation
  const startRename = useCallback((id: string, currentTitle: string) => {
    setEditingTitle(id);
    setTitleInput(currentTitle);
  }, []);

  const saveRename = useCallback(async (id: string) => {
    if (!titleInput.trim()) {
      setEditingTitle(null);
      return;
    }
    const newTitle = titleInput.trim();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    setEditingTitle(null);
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch { /* ignore */ }
  }, [titleInput]);

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

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

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
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: displayContent, createdAt: Date.now() };
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

    // Update title in Supabase if this is a new conversation
    const isNewConv = !conversations.find((c) => c.id === convId);
    if (isNewConv || conversations.find((c) => c.id === convId)?.title === "New Chat") {
      const newTitle = msg.slice(0, 40) || (filesToSend.length > 0 ? `Arquivo(s) (${filesToSend.length})` : "New Chat");
      const patchBody: Record<string, unknown> = { title: newTitle, model: selectedModel };
      if (user?.id) patchBody.user_id = user.id;
      fetch(`/api/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      }).catch((e) => console.error("Title save error:", e));
    }

    const assistantId = crypto.randomUUID();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", createdAt: Date.now() }] }
          : c
      )
    );

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Get messages from the conversation that was active when send was clicked
      const currentConv = conversations.find(c => c.id === convId);
      const messagesForApi = (currentConv?.messages || []).slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Add system instructions if set
      const systemInstruction = settings.systemInstructions.trim();
      let finalMessagesForApi: { role: string; content: string }[] = messagesForApi;
      if (systemInstruction) {
        finalMessagesForApi = [{ role: "system", content: systemInstruction }, ...messagesForApi];
      }

      let res;
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", msg);
        formData.append("messages", JSON.stringify(finalMessagesForApi));
        formData.append("conversationId", convId);
        formData.append("model", selectedModel);
        formData.append("temperature", String(settings.temperature));
        formData.append("systemInstructions", systemInstruction);
        filesToSend.forEach((f) => formData.append("files", f));

        res = await fetch("/api/chat", { method: "POST", body: formData, signal: controller.signal });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            conversationId: convId,
            messages: finalMessagesForApi,
            model: selectedModel,
            temperature: settings.temperature,
            systemInstructions: systemInstruction,
          }),
          signal: controller.signal,
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
      // Ignore abort errors
      if (e instanceof DOMException && e.name === "AbortError") {
        // Streaming was cancelled, that's fine
      } else {
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
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [input, isStreaming, activeId, activeConversation?.messages, files, selectedModel, settings.systemInstructions, settings.temperature, user?.id]);

  // Regenerate: remove last assistant message and resend last user message
  const regenerate = useCallback(() => {
    if (!activeConversation || activeConversation.messages.length < 2) return;
    const msgs = activeConversation.messages;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role !== "assistant") return;

    // Find the last user message
    let lastUserMsgIndex = -1;
    for (let i = msgs.length - 2; i >= 0; i--) {
      if (msgs[i].role === "user") {
        lastUserMsgIndex = i;
        break;
      }
    }
    if (lastUserMsgIndex === -1) return;

    // Remove the last assistant message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.slice(0, -1) }
          : c
      )
    );

    // Re-send the last user message
    const lastUserContent = msgs[lastUserMsgIndex].content;
    // Remove metadata like [Arquivo(s) enviado(s): ...] if present
    const cleanContent = lastUserContent.replace(/^\[Arquivo\(s\) enviado\(s\):.*?\]$/, "").trim();
    if (cleanContent) {
      setTimeout(() => sendMessage(cleanContent), 0);
    } else {
      // Just re-trigger with the same text
      setTimeout(() => {
        sendMessage(lastUserContent);
      }, 0);
    }
  }, [activeConversation, activeId, sendMessage]);

  // Edit message
  const startEditMessage = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  }, []);

  const cancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditContent("");
  }, []);

  const saveEditMessage = useCallback((msgId: string) => {
    if (!activeConversation) return;
    const msgs = activeConversation.messages;
    const msgIndex = msgs.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    // Update the message and truncate all following messages
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages
                .map((m, i) =>
                  i === msgIndex ? { ...m, content: editContent } : m
                )
                .slice(0, msgIndex + 1),
            }
          : c
      )
    );
    setEditingMessageId(null);
    setEditContent("");
  }, [activeConversation, activeId, editContent]);

  // Delete message
  const deleteMessage = useCallback((msgId: string) => {
    if (!window.confirm("Delete this message and all following messages?")) return;
    if (!activeConversation) return;
    const msgs = activeConversation.messages;
    const msgIndex = msgs.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.slice(0, msgIndex) }
          : c
      )
    );
  }, [activeConversation, activeId]);

  // Export
  const exportAsJSON = useCallback(() => {
    if (!activeConversation) return;
    const data = {
      title: activeConversation.title,
      createdAt: activeConversation.createdAt,
      model: selectedModel,
      messages: activeConversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConversation.title.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  }, [activeConversation, selectedModel]);

  const exportAsMarkdown = useCallback(() => {
    if (!activeConversation) return;
    let md = `# ${activeConversation.title}\n\n`;
    md += `_Exported from Hermes Chat — ${new Date().toLocaleDateString("pt-BR")}_\n\n---\n\n`;
    for (const msg of activeConversation.messages) {
      if (msg.role === "user") {
        md += `**You:** ${msg.content}\n\n`;
      } else {
        md += `**Hermes:** ${msg.content}\n\n`;
      }
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConversation.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  }, [activeConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Compute filtered conversations for sidebar
  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, sidebarSearch]);

  // Current time for relative timestamps
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={clsx(
      "flex h-screen overflow-hidden",
      theme === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-zinc-950 text-zinc-100'
    )}>
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed md:relative z-50 md:z-auto h-full w-72 border-r flex flex-col transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
      )}>
        <div className={clsx(
          "p-4 border-b flex items-center justify-between",
          theme === 'light' ? 'border-gray-200' : 'border-zinc-800'
        )}>
          <h1 className={clsx(
            "text-lg font-semibold",
            theme === 'light' ? 'text-gray-900' : 'text-zinc-100'
          )}>Hermes Chat</h1>
          <button onClick={() => setSidebarOpen(false)} className={clsx(
            "md:hidden",
            theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-400 hover:text-zinc-200'
          )}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={14} className={clsx(
              "absolute left-3 top-1/2 -translate-y-1/2",
              theme === 'light' ? 'text-gray-400' : 'text-zinc-500'
            )} />
            <input
              ref={sidebarSearchRef}
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search conversations..."
              className={clsx(
                "w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50",
                theme === 'light'
                  ? 'bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-400'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500'
              )}
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch("")}
                className={clsx(
                  "absolute right-2 top-1/2 -translate-y-1/2",
                  theme === 'light' ? 'text-gray-400 hover:text-gray-600' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* New Chat */}
        <div className="p-3">
          <button onClick={newChat} className={clsx(
            "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            theme === 'light'
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
          )}>
            <Plus size={16} /> New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {filteredConversations.length === 0 && sidebarSearch.trim() ? (
            <p className={clsx(
              "text-center text-sm py-4",
              theme === 'light' ? 'text-gray-400' : 'text-zinc-500'
            )}>No conversations found</p>
          ) : (
            filteredConversations.map((c) => (
              <div
                key={c.id}
                className={clsx(
                  "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                  activeId === c.id
                    ? theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-zinc-800 text-zinc-100'
                    : theme === 'light' ? 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                )}
                onClick={() => { setActiveId(c.id); setSidebarOpen(false); }}
              >
                <MessageSquare size={14} className="shrink-0" />
                {editingTitle === c.id ? (
                  <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(c.id); if (e.key === "Escape") setEditingTitle(null); }}
                      className={clsx(
                        "flex-1 min-w-0 border rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500",
                        theme === 'light'
                          ? 'bg-gray-200 border-gray-400 text-gray-800'
                          : 'bg-zinc-700 border-zinc-600 text-zinc-200'
                      )}
                    />
                    <button onClick={() => saveRename(c.id)} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingTitle(null)} className={clsx(
                      "p-0.5",
                      theme === 'light' ? 'text-gray-400 hover:text-gray-600' : 'text-zinc-400 hover:text-zinc-300'
                    )}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <span
                    className="flex-1 text-sm truncate"
                    onClick={() => { setActiveId(c.id); setSidebarOpen(false); }}
                  >
                    {c.title}
                  </span>
                )}
                {editingTitle !== c.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(c.id, c.title); }}
                      className={clsx(
                        "p-1",
                        theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-500 hover:text-zinc-300'
                      )}
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={async (e) => { e.stopPropagation(); if (window.confirm("Delete this conversation?")) deleteChat(c.id); }}
                      className={clsx(
                        "p-1",
                        theme === 'light' ? 'text-gray-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                      )}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={clsx(
          "h-14 border-b flex items-center px-4 gap-3 backdrop-blur",
          theme === 'light'
            ? 'border-gray-200 bg-white/80'
            : 'border-zinc-800 bg-zinc-950/80'
        )}>
          <button onClick={() => setSidebarOpen(true)} className={clsx(
            "md:hidden",
            theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-400 hover:text-zinc-200'
          )}>
            <Menu size={20} />
          </button>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                theme === 'light'
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              )}
            >
              <Bot size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">{availableModels.find(m => m.id === selectedModel)?.name || selectedModel}</span>
              <ChevronDown size={14} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <div className={clsx(
                  "absolute top-full left-0 mt-1 w-64 border rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto",
                  theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
                )}>
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model.id); setModelDropdownOpen(false); }}
                      className={clsx(
                        "w-full text-left px-4 py-2.5 transition-colors",
                        selectedModel === model.id
                          ? theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'
                          : theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-zinc-800'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={clsx(
                          "text-sm font-medium",
                          theme === 'light' ? 'text-gray-800' : 'text-zinc-200'
                        )}>{model.name}</span>
                        {selectedModel === model.id && <Check size={14} className="text-emerald-400" />}
                      </div>
                      <span className={clsx(
                        "text-xs",
                        theme === 'light' ? 'text-gray-500' : 'text-zinc-500'
                      )}>{model.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <h2 className={clsx(
            "text-sm font-medium truncate flex-1",
            theme === 'light' ? 'text-gray-600' : 'text-zinc-300'
          )}>
            {activeConversation?.title || "Hermes Chat"}
          </h2>

          {/* Export button */}
          {activeConversation && activeConversation.messages.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className={clsx(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
                  theme === 'light'
                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                )}
                title="Export"
              >
                <Download size={16} />
                <span className="hidden sm:inline text-xs">Export</span>
              </button>
              {exportDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} />
                  <div className={clsx(
                    "absolute right-0 top-full mt-1 w-48 border rounded-lg shadow-xl z-50 py-1",
                    theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
                  )}>
                    <button
                      onClick={exportAsJSON}
                      className={clsx(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors",
                        theme === 'light' ? 'text-gray-700 hover:bg-gray-50' : 'text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={exportAsMarkdown}
                      className={clsx(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors",
                        theme === 'light' ? 'text-gray-700 hover:bg-gray-50' : 'text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      Export as Markdown
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className={clsx(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
              theme === 'light'
                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            )}
            title="Settings"
          >
            <Settings size={16} />
          </button>

          {/* Auth */}
          {authLoading ? (
            <div className={clsx(
              "w-8 h-8 rounded-full animate-pulse",
              theme === 'light' ? 'bg-gray-200' : 'bg-zinc-800'
            )} />
          ) : user ? (
            <div className="flex items-center gap-2">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name || "User"}
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <div className={clsx(
                  "w-7 h-7 rounded-full flex items-center justify-center",
                  theme === 'light' ? 'bg-gray-200 text-gray-500' : 'bg-zinc-700 text-zinc-400'
                )}>
                  <User size={14} />
                </div>
              )}
              <button
                onClick={signOut}
                className={clsx(
                  "transition-colors",
                  theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-400 hover:text-zinc-200'
                )}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGithub}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                theme === 'light'
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              )}
            >
              <User size={14} />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className={clsx(
                "text-2xl font-semibold mb-2",
                theme === 'light' ? 'text-gray-800' : 'text-zinc-100'
              )}>How can I help?</h2>
              <p className={clsx(
                "mb-8 text-center max-w-md",
                theme === 'light' ? 'text-gray-500' : 'text-zinc-400'
              )}>Start a conversation or try one of the quick actions below.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg w-full">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { setInput(action.prompt); textareaRef.current?.focus(); }}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                      theme === 'light'
                        ? 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300 hover:text-zinc-100'
                    )}
                  >
                    <action.icon size={20} />
                    <span className="text-xs font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
              {activeConversation.messages.map((msg, idx) => (
                <div key={msg.id} className={`group flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles size={14} className="text-white" />
                    </div>
                  )}
                  <div className={clsx(
                    "max-w-[85%]",
                    msg.role === "user"
                      ? theme === 'light'
                        ? 'bg-emerald-50 rounded-2xl rounded-br-md px-4 py-3 text-gray-800'
                        : 'bg-zinc-800 rounded-2xl rounded-br-md px-4 py-3 text-zinc-100'
                      : theme === 'light' ? 'text-gray-800' : 'text-zinc-200'
                  )}>
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEditMessage(msg.id);
                            }
                            if (e.key === "Escape") cancelEditMessage();
                          }}
                          className={clsx(
                            "w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                            theme === 'light'
                              ? 'bg-white border-gray-300 text-gray-800'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                          )}
                          rows={4}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => saveEditMessage(msg.id)}
                            className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                          >
                            <Check size={12} /> Save
                          </button>
                          <button
                            onClick={cancelEditMessage}
                            className={clsx(
                              "flex items-center gap-1 px-3 py-1 rounded-md text-xs",
                              theme === 'light'
                                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                            )}
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : msg.role === "user" ? (
                      <>
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        {/* Action buttons on hover */}
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditMessage(msg)}
                            className={clsx(
                              "p-1",
                              theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-500 hover:text-zinc-300'
                            )}
                            title="Edit message"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className={clsx(
                              "p-1",
                              theme === 'light' ? 'text-gray-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                            )}
                            title="Delete message"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    ) : msg.content ? (
                      <>
                        <MessageContent content={msg.content} />
                        {/* Action buttons on hover */}
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx === activeConversation.messages.length - 1 && (
                            <button
                              onClick={regenerate}
                              className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                                theme === 'light'
                                  ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                              )}
                              title="Regenerate"
                            >
                              <RotateCcw size={12} /> Regenerate
                            </button>
                          )}
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className={clsx(
                              "p-1",
                              theme === 'light' ? 'text-gray-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                            )}
                            title="Delete message"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 py-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                      </div>
                    )}

                    {/* Timestamp */}
                    {msg.createdAt && (
                      <div className={clsx(
                        "text-xs mt-1",
                        editingMessageId === msg.id ? "hidden" : "",
                        theme === 'light' ? 'text-gray-400' : 'text-zinc-500'
                      )}>
                        {formatRelativeTime(new Date(msg.createdAt))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className={clsx(
          "border-t p-4 backdrop-blur",
          theme === 'light'
            ? 'border-gray-200 bg-white/80'
            : 'border-zinc-800 bg-zinc-950/80'
        )}>
          <div className="max-w-3xl mx-auto relative">
            {/* File previews */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((file, i) => {
                  const isImage = file.type.startsWith("image/");
                  const previewUrl = imagePreviews[i];
                  return (
                    <div key={i} className="relative group/file">
                      {isImage && previewUrl ? (
                        <div className={clsx(
                          "relative rounded-lg overflow-hidden border",
                          theme === 'light' ? 'border-gray-300' : 'border-zinc-700'
                        )}>
                          <img
                            src={previewUrl}
                            alt={file.name}
                            className="w-16 h-16 object-cover cursor-pointer"
                            onClick={() => setFullscreenImage(previewUrl)}
                          />
                          <button
                            onClick={() => removeFile(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-zinc-300 hover:text-red-400 opacity-0 group-hover/file:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className={clsx(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                          theme === 'light'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-zinc-800 text-zinc-300'
                        )}>
                          {getFileIcon(file)}
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button onClick={() => removeFile(i)} className={clsx(
                            theme === 'light' ? 'text-gray-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                          )}>
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Hermes..."
              rows={1}
              className={clsx(
                "w-full resize-none rounded-xl border px-4 py-3 pr-28 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all max-h-40 overflow-y-auto",
                theme === 'light'
                  ? 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500'
              )}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'light'
                    ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                )}
                title="Attach files"
              >
                <Paperclip size={16} />
              </button>
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-white"
                  title="Stop generating"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() && files.length === 0}
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 transition-colors text-white"
                  title="Send"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
          <p className={clsx(
            "text-center text-xs mt-2",
            theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
          )}>Hermes can make mistakes. Verify important information.</p>
        </div>
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.pdf,.doc,.docx,.xls,.xlsx,.zip"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Fullscreen Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 p-2"
          >
            <X size={24} />
          </button>
          <img
            src={fullscreenImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={clsx(
              "w-full max-w-md border rounded-2xl p-6 shadow-2xl",
              theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx(
                "text-lg font-semibold flex items-center gap-2",
                theme === 'light' ? 'text-gray-900' : 'text-zinc-100'
              )}>
                <Settings size={18} /> Settings
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className={clsx(
                  "p-1",
                  theme === 'light' ? 'text-gray-400 hover:text-gray-700' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <X size={18} />
              </button>
            </div>

            {/* Theme Toggle */}
            <div className="mb-5">
              <label className={clsx(
                "text-sm font-medium mb-2 block",
                theme === 'light' ? 'text-gray-700' : 'text-zinc-300'
              )}>Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, theme: "dark" }))}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors",
                    settings.theme === "dark"
                      ? theme === 'light'
                        ? 'bg-gray-200 text-gray-800 ring-1 ring-emerald-500'
                        : 'bg-zinc-700 text-zinc-100 ring-1 ring-emerald-500'
                      : theme === 'light'
                        ? 'bg-gray-100 text-gray-400 hover:text-gray-600'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                  )}
                >
                  <Moon size={16} /> Dark
                </button>
                <button
                  onClick={() => setSettings((s) => ({ ...s, theme: "light" }))}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors",
                    settings.theme === "light"
                      ? theme === 'light'
                        ? 'bg-gray-200 text-gray-800 ring-1 ring-emerald-500'
                        : 'bg-zinc-700 text-zinc-100 ring-1 ring-emerald-500'
                      : theme === 'light'
                        ? 'bg-gray-100 text-gray-400 hover:text-gray-600'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                  )}
                >
                  <Sun size={16} /> Light
                </button>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="mb-5">
              <label className={clsx(
                "text-sm font-medium mb-2 flex items-center gap-2",
                theme === 'light' ? 'text-gray-700' : 'text-zinc-300'
              )}>
                <Sliders size={14} /> Temperature: {settings.temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
                className={clsx(
                  "w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500",
                  theme === 'light' ? 'bg-gray-200' : 'bg-zinc-700'
                )}
              />
              <div className={clsx(
                "flex justify-between text-xs mt-1",
                theme === 'light' ? 'text-gray-400' : 'text-zinc-500'
              )}>
                <span>Precise (0)</span>
                <span>Creative (1)</span>
              </div>
            </div>

            {/* Model Selector */}
            <div className="mb-5">
              <label className={clsx(
                "text-sm font-medium mb-2 block",
                theme === 'light' ? 'text-gray-700' : 'text-zinc-300'
              )}>Model</label>
              <div className={clsx(
                "max-h-40 overflow-y-auto space-y-1 rounded-lg border p-1",
                theme === 'light' ? 'border-gray-200' : 'border-zinc-700'
              )}>
                {availableModels.map((model) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={clsx(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                        isSelected
                          ? theme === 'light'
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'bg-emerald-600/10 text-emerald-400 font-medium'
                          : theme === 'light'
                            ? 'hover:bg-gray-100 text-gray-700'
                            : 'hover:bg-zinc-800 text-zinc-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{model.name}</span>
                        {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                      </div>
                      <span className={clsx(
                        "text-xs",
                        theme === 'light' ? 'text-gray-400' : 'text-zinc-500'
                      )}>{model.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Instructions */}
            <div className="mb-5">
              <label className={clsx(
                "text-sm font-medium mb-2 block",
                theme === 'light' ? 'text-gray-700' : 'text-zinc-300'
              )}>System Instructions</label>
              <textarea
                value={settings.systemInstructions}
                onChange={(e) => setSettings((s) => ({ ...s, systemInstructions: e.target.value }))}
                placeholder="Optional system prompt..."
                rows={4}
                className={clsx(
                  "w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500'
                )}
              />
            </div>

            <button
              onClick={() => setSettingsOpen(false)}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
