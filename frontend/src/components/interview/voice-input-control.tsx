"use client";

import * as React from "react";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  AlertCircle,
  X,
  Volume2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useSpeechRecognition,
  UseSpeechRecognitionReturn,
} from "@/lib/use-speech-recognition";
import { SpeechRecognitionErrorDetails } from "@/lib/speech-recognition";

export interface VoiceInputControlProps {
  onTranscriptReceived: (finalTranscript: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputControl({
  onTranscriptReceived,
  disabled = false,
  className = "",
}: VoiceInputControlProps) {
  const [showUnsupportedDismissed, setShowUnsupportedDismissed] = React.useState(false);

  const handleFinalized = React.useCallback(
    (text: string) => {
      if (text && text.trim()) {
        onTranscriptReceived(text.trim());
      }
    },
    [onTranscriptReceived]
  );

  const speech: UseSpeechRecognitionReturn = useSpeechRecognition({
    lang: "en-US",
    continuous: true,
    interimResults: true,
    onTranscriptFinalized: handleFinalized,
  });

  const {
    isSupported,
    state,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearError,
  } = speech;

  const isListening = state === "listening";
  const isRequesting = state === "requesting_permission";
  const isProcessing = state === "processing";
  const isCompleted = state === "completed";

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Live Interim Speech Preview Pill */}
      {isListening && interimTranscript && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm"
        >
          <div className="flex items-center gap-1 shrink-0 text-indigo-400">
            <Volume2 className="h-3.5 w-3.5 animate-pulse" />
            <span className="font-semibold text-[11px] uppercase tracking-wider font-mono">
              Live Speech:
            </span>
          </div>
          <p className="italic font-mono text-xs text-white/90 truncate flex-1">
            &ldquo;{interimTranscript}&rdquo;
          </p>
        </div>
      )}

      {/* Main Microphone Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Voice Toggle Button */}
          {!isListening ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isRequesting || isProcessing || !isSupported}
              onClick={startListening}
              aria-label={!isSupported ? "Voice input requires Chrome, Edge, or Safari" : isRequesting ? "Requesting microphone permission" : "Speak your answer using microphone"}
              className={`gap-2 h-9 px-3.5 rounded-xl text-xs font-medium border transition-all ${
                !isSupported
                  ? "border-slate-800 bg-[#060a14] text-slate-500 cursor-not-allowed opacity-60"
                  : isCompleted
                  ? "border-emerald-600/60 bg-emerald-950/30 text-emerald-300"
                  : "border-slate-700/80 bg-[#080e1c] text-slate-300 hover:text-white hover:border-indigo-500/60 hover:bg-indigo-950/30"
              }`}
            >
              {!isSupported ? (
                <>
                  <MicOff className="h-3.5 w-3.5 text-slate-500" />
                  <span>Voice Not Supported</span>
                </>
              ) : isRequesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span>Requesting mic access…</span>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span>Processing speech…</span>
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Speech Added</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Speak Your Answer</span>
                </>
              )}
            </Button>
          ) : (
            /* Active Listening State with Explicit Stop Button */
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={stopListening}
                aria-label="Stop voice recording"
                className="gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/40 animate-pulse"
              >
                <Square className="h-3 w-3 fill-white" />
                <span>Stop Recording</span>
              </Button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span>Listening… Speak clearly</span>
              </div>
            </div>
          )}

          {/* Voice Input Privacy & Hint Note */}
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Speech converts to editable text in-browser. You can review and edit before submitting.
          </span>
        </div>

        {/* Browser Compatibility Notice Badge */}
        {!isSupported && !showUnsupportedDismissed && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-800/40">
            <Info className="h-3 w-3 text-amber-400 shrink-0" />
            <span>Voice input requires Chrome, Edge, or Safari</span>
            <button
              type="button"
              onClick={() => setShowUnsupportedDismissed(true)}
              className="text-amber-400 hover:text-amber-200 ml-1"
              aria-label="Dismiss unsupported message"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Actionable Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-rose-800/60 bg-rose-950/30 text-xs text-rose-200 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">{error.message}</p>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                {error.actionableHint}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-400 hover:text-rose-200 p-1 shrink-0 rounded-lg hover:bg-rose-900/40"
            aria-label="Dismiss speech recognition error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
