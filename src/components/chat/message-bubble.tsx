"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { User, Bot, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Message } from "@/lib/store";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-white/[0.1]"
            : "bg-gradient-to-br from-violet-500 to-indigo-500"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white/80" />
        ) : (
          <span className="text-white text-xs font-bold">H</span>
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "relative max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-white/[0.08] text-white/90"
            : "bg-white/[0.03] text-white/80 border border-white/[0.05]"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity",
            "p-1 rounded text-white/30 hover:text-white/60",
            isUser ? "right-0" : "left-0"
          )}
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
