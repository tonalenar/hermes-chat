export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Simple client-side store using localStorage
const STORAGE_KEY = "hermes-chat-conversations";

export function getConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored).map((c: Conversation) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      messages: c.messages.map((m: Message) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function createConversation(): Conversation {
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const conversations = getConversations();
  conversations.unshift(conv);
  saveConversations(conversations);
  return conv;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Message {
  const message: Message = {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
  };
  const conversations = getConversations();
  const conv = conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.messages.push(message);
    conv.updatedAt = new Date();
    // Auto-title from first user message
    if (conv.messages.filter((m) => m.role === "user").length === 1) {
      conv.title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    }
    saveConversations(conversations);
  }
  return message;
}

export function deleteConversation(id: string) {
  const conversations = getConversations().filter((c) => c.id !== id);
  saveConversations(conversations);
}

export function getConversation(id: string): Conversation | undefined {
  return getConversations().find((c) => c.id === id);
}
