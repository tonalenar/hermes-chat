"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { User, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Message } from "@/lib/store";
import ReactMarkdown from "react-markdown";

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
      className={cn("flex gap-3 group relative", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser ? "bg-white/[0.1]" : "bg-gradient-to-br from-violet-500 to-indigo-500"
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
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:bg-white/[0.05] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-violet-400 [&_a]:underline [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:border-violet-500/50 [&_blockquote]:text-white/60">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Copy Button - visible on hover, positioned inside the bubble */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/80",
            isUser ? "left-2" : "right-2"
          )}
          aria-label="Copy message"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}
