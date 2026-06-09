"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Sidebar } from "@/components/chat/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Conversation,
  Message,
  getConversations,
  createConversation,
  addMessage,
  getConversation,
} from "@/lib/store";

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-white/60 rounded-full"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversations(getConversations());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, isTyping]);

  const refreshConversations = () => setConversations(getConversations());

  const handleNewConversation = () => {
    const conv = createConversation();
    setActiveConversation(conv);
    refreshConversations();
  };

  const handleSelectConversation = (conv: Conversation) => {
    const full = getConversation(conv.id);
    if (full) setActiveConversation(full);
  };

  const handleSendMessage = async (content: string) => {
    let conv = activeConversation;

    if (!conv) {
      conv = createConversation();
      setActiveConversation(conv);
    }

    addMessage(conv.id, "user", content);
    const updated = getConversation(conv.id);
    if (updated) setActiveConversation(updated);
    refreshConversations();

    setIsTyping(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationHistory: updated?.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) || [],
        }),
      });

      const data = await response.json();

      if (data.response) {
        addMessage(conv.id, "assistant", data.response);
      } else {
        addMessage(conv.id, "assistant", `Error: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      addMessage(
        conv.id,
        "assistant",
        `Connection error: ${error instanceof Error ? error.message : "Failed to reach Hermes"}`
      );
    } finally {
      setIsTyping(false);
      const final = getConversation(conv!.id);
      if (final) setActiveConversation(final);
      refreshConversations();
    }
  };

  const handleDeleteConversation = (id: string) => {
    const { deleteConversation } = require("@/lib/store");
    deleteConversation(id);
    if (activeConversation?.id === id) {
      setActiveConversation(null);
    }
    refreshConversations();
  };

  const hasMessages = activeConversation && activeConversation.messages.length > 0;

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-white overflow-hidden">
      <Sidebar
        activeConversationId={activeConversation?.id || null}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px]" />
        </div>

        {/* Messages Area */}
        {hasMessages ? (
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pt-6 pb-4 relative z-10">
            <div className="max-w-2xl mx-auto space-y-6">
              {activeConversation!.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">H</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <span>Thinking</span>
                      <TypingDots />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
            <div className="text-center space-y-3 mb-12">
              <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40">
                How can I help today?
              </h1>
              <p className="text-sm text-white/40">Type a command or ask a question</p>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="relative z-10 pb-6 px-4">
          <AnimatedAIChat
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            placeholder={hasMessages ? "Continue the conversation..." : "Ask Hermes a question..."}
          />
        </div>
      </main>
    </div>
  );
}
