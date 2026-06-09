"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, SendIcon, LoaderIcon, Command, Bug, Lightbulb, MonitorIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  prefix: string;
}

interface AnimatedAIChatProps {
  onSendMessage: (message: string) => void;
  isTyping?: boolean;
  placeholder?: string;
}

export function AnimatedAIChat({ onSendMessage, isTyping = false, placeholder = "Ask Hermes a question..." }: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 200 });
  const commandPaletteRef = useRef<HTMLDivElement>(null);

  const commandSuggestions: CommandSuggestion[] = [
    { icon: <Sparkles className="w-4 h-4" />, label: "Analyze", prefix: "/analyze" },
    { icon: <MonitorIcon className="w-4 h-4" />, label: "Create", prefix: "/create" },
    { icon: <Bug className="w-4 h-4" />, label: "Debug", prefix: "/debug" },
    { icon: <Lightbulb className="w-4 h-4" />, label: "Explain", prefix: "/explain" },
  ];

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);
      const idx = commandSuggestions.findIndex((c) => c.prefix.startsWith(value));
      setActiveSuggestion(idx >= 0 ? idx : -1);
    } else {
      setShowCommandPalette(false);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const cmdBtn = document.querySelector("[data-command-button]");
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(target) && !cmdBtn?.contains(target)) {
        setShowCommandPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!value.trim() || isTyping) return;
    onSendMessage(value.trim());
    setValue("");
    adjustHeight(true);
  };

  const handleQuickAction = (prompt: string) => {
    if (isTyping) return;
    setValue(prompt);
    // Focus textarea so user can complete the prompt
    textareaRef.current?.focus();
    setTimeout(() => adjustHeight(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((p) => (p < commandSuggestions.length - 1 ? p + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((p) => (p > 0 ? p - 1 : commandSuggestions.length - 1));
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          setValue(commandSuggestions[activeSuggestion].prefix + " ");
          setShowCommandPalette(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { icon: <Sparkles className="w-4 h-4" />, label: "Analyze", prompt: "Analyze the following and provide insights: " },
    { icon: <MonitorIcon className="w-4 h-4" />, label: "Create", prompt: "Create a detailed plan for: " },
    { icon: <Bug className="w-4 h-4" />, label: "Debug", prompt: "Debug this issue and find the root cause: " },
    { icon: <Lightbulb className="w-4 h-4" />, label: "Explain", prompt: "Explain in detail: " },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl"
        initial={{ scale: 0.98 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Command Palette */}
        <AnimatePresence>
          {showCommandPalette && (
            <motion.div
              ref={commandPaletteRef}
              className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
            >
              <div className="py-1 bg-black/95">
                {commandSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.prefix}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                      activeSuggestion === index ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                    )}
                    onClick={() => {
                      setValue(suggestion.prefix + " ");
                      setShowCommandPalette(false);
                      textareaRef.current?.focus();
                    }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center text-white/60">{suggestion.icon}</div>
                    <div className="font-medium">{suggestion.label}</div>
                    <div className="text-white/40 text-xs ml-1">{suggestion.prefix}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <div className="p-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isTyping}
            className="w-full px-4 py-3 resize-none bg-transparent border-none text-white/90 text-sm focus:outline-none placeholder:text-white/20 min-h-[48px] disabled:opacity-50"
            style={{ overflow: "hidden" }}
            rows={1}
          />
        </div>

        {/* Bottom bar */}
        <div className="px-4 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              data-command-button
              onClick={() => setShowCommandPalette((p) => !p)}
              whileTap={{ scale: 0.94 }}
              className={cn(
                "p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors",
                showCommandPalette && "bg-white/10 text-white/90"
              )}
            >
              <Command className="w-4 h-4" />
            </motion.button>
          </div>

          <motion.button
            type="button"
            onClick={handleSend}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={isTyping || !value.trim()}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              value.trim() && !isTyping
                ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10"
                : "bg-white/[0.05] text-white/40 cursor-not-allowed"
            )}
          >
            {isTyping ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
            <span>{isTyping ? "Thinking..." : "Send"}</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Quick Actions - only shown when no active typing */}
      {!isTyping && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-white/[0.1] rounded-lg text-sm text-white/50 hover:text-white/90 transition-all"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
