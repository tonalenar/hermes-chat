"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Conversation,
  getConversations,
  createConversation,
  deleteConversation,
} from "@/lib/store";

interface SidebarProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  onNew: () => void;
}

export function Sidebar({ activeConversationId, onSelect, onNew }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setConversations(getConversations());
    const handleStorage = () => setConversations(getConversations());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const refresh = () => setConversations(getConversations());

  const handleNew = () => {
    onNew();
    setTimeout(refresh, 50);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
    refresh();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">H</span>
            </div>
            <span className="text-white/90 font-medium text-sm">Hermes Chat</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 text-white/40 hover:text-white/90 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-white/80 hover:text-white text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        <AnimatePresence>
          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                activeConversationId === conv.id
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
              )}
              onClick={() => {
                onSelect(conv);
                setIsMobileOpen(false);
              }}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate text-sm">{conv.title}</span>
              <button
                onClick={(e) => handleDelete(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {conversations.length === 0 && (
          <div className="text-center text-white/30 text-sm mt-8">
            No conversations yet
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.05]">
        <div className="text-xs text-white/30 text-center">
          Hermes Agent v1.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white/[0.05] backdrop-blur-xl rounded-lg border border-white/[0.05] text-white/80"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "fixed lg:relative z-50 h-full w-72 bg-black/40 backdrop-blur-2xl border-r border-white/[0.05]",
          "transition-transform duration-200",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
