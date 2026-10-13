"use client";

import * as React from "react";
import {
  BrainCircuit,
  Lock,
  MessageCircle,
  Send,
  Loader2,
  Sparkles,
  BookOpen,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiAssistantPanelProps {
  mode: "practice" | "interview";
  /** Live session context — required in interview mode */
  sessionId?: string;
  questionTopic?: string;
  questionCategory?: string;
  targetRole?: string;
  experienceLevel?: string;
  /** Optional initial collapsed state */
  defaultCollapsed?: boolean;
}

export function AiAssistantPanel({
  mode,
  sessionId,
  questionTopic,
  questionCategory,
  targetRole,
  experienceLevel,
  defaultCollapsed = false,
}: AiAssistantPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputText, setInputText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages update
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          userMessage: text,
          sessionId,
          questionTopic,
          questionCategory,
          targetRole,
          experienceLevel,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError(data.error || "Access denied.");
        } else {
          setError("Failed to get a response. Please try again.");
        }
        return;
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.message || "I could not generate a response.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    setInputText("");
  }

  const isInterviewMode = mode === "interview";

  return (
    <div className={`rounded-2xl border shadow-md overflow-hidden transition-all ${
      isInterviewMode
        ? "border-violet-800/50 bg-gradient-to-b from-[#0d0e1f] to-[#0a0b1a]"
        : "border-indigo-700/40 bg-gradient-to-b from-[#0d1227] to-[#080e1e]"
    }`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b cursor-pointer select-none ${
          isInterviewMode ? "border-violet-800/40" : "border-indigo-800/40"
        }`}
        onClick={() => setIsCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
            isInterviewMode
              ? "bg-violet-950/60 border border-violet-700/50"
              : "bg-indigo-950/60 border border-indigo-700/50"
          }`}>
            {isInterviewMode ? (
              <Lock className="h-3.5 w-3.5 text-violet-400" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">AI Assistant</span>
              {isInterviewMode ? (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-violet-700/60 text-violet-300 bg-violet-950/40">
                  Interview Mode
                </Badge>
              ) : (
                <Badge variant="success" className="text-[10px] py-0 px-1.5 gap-1">
                  <BookOpen className="h-2.5 w-2.5" />
                  Practice Mode
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isInterviewMode
                ? "Topic awareness only — answers are not provided"
                : "Full AI tutor — ask anything"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && !isCollapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); clearChat(); }}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
              title="Clear chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Interview Mode Warning Banner */}
          {isInterviewMode && (
            <div className="flex items-start gap-2 px-4 py-2.5 border-b border-violet-900/40 bg-violet-950/20 text-[11px] text-violet-300">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-400" />
              <span>
                <strong className="text-violet-200">Integrity Mode Active:</strong> This assistant will not provide
                answers or code solutions during your live interview. Topic context questions only.
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 p-4 overflow-y-auto"
            style={{ maxHeight: "320px", minHeight: messages.length === 0 ? "80px" : "160px" }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                {isInterviewMode ? (
                  <>
                    <Lock className="h-6 w-6 text-violet-500/60" />
                    <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
                      Ask about <strong className="text-slate-400">topic concepts</strong> or request guidance on
                      structuring your response. Answers to the active question are locked.
                    </p>
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-6 w-6 text-indigo-500/60" />
                    <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
                      Ask me anything about <strong className="text-slate-400">algorithms, system design, frameworks</strong>,
                      or request a mock interview answer.
                    </p>
                  </>
                )}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className={`text-[10px] font-semibold ${
                  msg.role === "user" ? "text-slate-400" : isInterviewMode ? "text-violet-400" : "text-indigo-400"
                }`}>
                  {msg.role === "user" ? "You" : "AI Coach"}
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed max-w-[95%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-tr-sm"
                      : isInterviewMode
                      ? "bg-violet-950/40 border border-violet-800/50 text-violet-100 rounded-tl-sm"
                      : "bg-indigo-950/40 border border-indigo-800/50 text-indigo-100 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className={`rounded-xl px-3 py-2 border flex items-center gap-2 text-[11px] ${
                  isInterviewMode
                    ? "bg-violet-950/40 border-violet-800/50 text-violet-300"
                    : "bg-indigo-950/40 border-indigo-800/50 text-indigo-300"
                }`}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-800/60 bg-rose-950/30 text-[11px] text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Input Area */}
          <div className={`px-4 pb-4 pt-2 border-t ${isInterviewMode ? "border-violet-900/40" : "border-indigo-900/40"}`}>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                id="ai-assistant-input"
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={
                  isInterviewMode
                    ? "Ask about topic concepts, domain vocabulary..."
                    : "Ask anything — concepts, code, mock answers..."
                }
                className={`text-[12px] resize-none rounded-xl bg-[#070b14] border text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 min-h-[52px] ${
                  isInterviewMode
                    ? "border-violet-800/50 focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20"
                    : "border-indigo-800/50 focus-visible:border-indigo-500/60 focus-visible:ring-indigo-500/20"
                }`}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isLoading || !inputText.trim()}
                id="ai-assistant-send"
                className={`h-9 w-9 p-0 rounded-xl shrink-0 ${
                  isInterviewMode
                    ? "bg-violet-700 hover:bg-violet-600"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              {isInterviewMode
                ? "Enter to send • Shift+Enter for newline • Answers to active questions are blocked"
                : "Enter to send • Shift+Enter for newline"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
