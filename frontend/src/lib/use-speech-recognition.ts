"use client";

import * as React from "react";
import {
  SpeechRecognitionState,
  SpeechRecognitionErrorDetails,
  IBrowserSpeechRecognition,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  normalizeSpeechError,
} from "./speech-recognition";

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscriptFinalized?: (finalText: string) => void;
  onError?: (error: SpeechRecognitionErrorDetails) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  state: SpeechRecognitionState;
  interimTranscript: string;
  finalTranscript: string;
  error: SpeechRecognitionErrorDetails | null;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
  clearError: () => void;
}

export function useSpeechRecognition({
  lang = "en-US",
  continuous = true,
  interimResults = true,
  onTranscriptFinalized,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = React.useState<boolean>(false);
  const [state, setState] = React.useState<SpeechRecognitionState>("idle");
  const [interimTranscript, setInterimTranscript] = React.useState<string>("");
  const [finalTranscript, setFinalTranscript] = React.useState<string>("");
  const [error, setError] = React.useState<SpeechRecognitionErrorDetails | null>(null);

  // Recognition instance & concurrency tracking refs
  const recognitionRef = React.useRef<IBrowserSpeechRecognition | null>(null);
  const isStartingRef = React.useRef<boolean>(false);
  const isStoppingRef = React.useRef<boolean>(false);
  const accumulatedFinalRef = React.useRef<string>("");
  const callbacksRef = React.useRef({ onTranscriptFinalized, onError });
  const currentStateRef = React.useRef<SpeechRecognitionState>("idle");

  const updateState = React.useCallback((nextState: SpeechRecognitionState) => {
    currentStateRef.current = nextState;
    setState(nextState);
  }, []);

  React.useEffect(() => {
    callbacksRef.current = { onTranscriptFinalized, onError };
  }, [onTranscriptFinalized, onError]);

  // Initial client-side feature check
  React.useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    setIsSupported(supported);
    if (!supported) {
      updateState("unsupported");
    }
  }, [updateState]);

  // Cleanup helper to abort and detach recognition
  const cleanupRecognition = React.useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Safe to ignore abort exceptions during teardown
      }
      recognitionRef.current = null;
    }
    isStartingRef.current = false;
    isStoppingRef.current = false;
  }, []);

  // Teardown on unmount
  React.useEffect(() => {
    return () => {
      cleanupRecognition();
    };
  }, [cleanupRecognition]);

  const clearError = React.useCallback(() => {
    setError(null);
    if (currentStateRef.current === "error") {
      updateState("idle");
    }
  }, [updateState]);

  const reset = React.useCallback(() => {
    cleanupRecognition();
    setInterimTranscript("");
    setFinalTranscript("");
    accumulatedFinalRef.current = "";
    setError(null);
    updateState(isSpeechRecognitionSupported() ? "idle" : "unsupported");
  }, [cleanupRecognition, updateState]);

  const stopListening = React.useCallback(() => {
    const current = currentStateRef.current;
    if (current !== "listening" && current !== "requesting_permission") {
      return;
    }

    isStoppingRef.current = true;
    updateState("processing");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Fallback to abort if stop fails
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    }

    // Deliver whatever final text has been committed so far
    const committed = accumulatedFinalRef.current.trim();
    if (committed && callbacksRef.current.onTranscriptFinalized) {
      callbacksRef.current.onTranscriptFinalized(committed);
    }

    setInterimTranscript("");
    updateState("completed");

    // After brief completion feedback, return state to idle
    setTimeout(() => {
      if (currentStateRef.current === "completed") {
        updateState("idle");
      }
      isStoppingRef.current = false;
    }, 600);
  }, [updateState]);

  const startListening = React.useCallback(() => {
    const current = currentStateRef.current;
    // Prevent duplicate sessions or starts while already listening or starting
    if (isStartingRef.current || current === "listening" || current === "requesting_permission") {
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      updateState("unsupported");
      const errDetails: SpeechRecognitionErrorDetails = {
        code: "service_not_allowed",
        message: "Speech recognition is not supported in this browser.",
        actionableHint: "Please use Google Chrome, Microsoft Edge, or Safari, or continue typing your answer directly.",
      };
      setError(errDetails);
      callbacksRef.current.onError?.(errDetails);
      return;
    }

    // Clean any prior instance
    cleanupRecognition();

    isStartingRef.current = true;
    updateState("requesting_permission");
    setError(null);
    setInterimTranscript("");
    setFinalTranscript("");
    accumulatedFinalRef.current = "";

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartingRef.current = false;
        updateState("listening");
      };

      recognition.onresult = (event: any) => {
        let interimText = "";
        let newFinalText = "";

        const resultsCount = event.results?.length ?? 0;
        for (let i = event.resultIndex || 0; i < resultsCount; i++) {
          const result = event.results[i];
          if (!result || !result[0]) continue;

          const transcriptChunk = result[0].transcript || "";
          if (result.isFinal) {
            newFinalText += transcriptChunk;
          } else {
            interimText += transcriptChunk;
          }
        }

        if (newFinalText.trim()) {
          const updatedFinal = accumulatedFinalRef.current
            ? `${accumulatedFinalRef.current} ${newFinalText.trim()}`
            : newFinalText.trim();
          accumulatedFinalRef.current = updatedFinal;
          setFinalTranscript(updatedFinal);

          // Deliver each committed sentence segment immediately
          if (callbacksRef.current.onTranscriptFinalized) {
            callbacksRef.current.onTranscriptFinalized(newFinalText.trim());
          }
        }

        setInterimTranscript(interimText.trim());
      };

      recognition.onerror = (event: any) => {
        const rawErr = event?.error || "unknown";
        // "aborted" often fires during clean manual stop/reset, don't flash error if stopping
        if (rawErr === "aborted" && isStoppingRef.current) {
          return;
        }

        const normalized = normalizeSpeechError(rawErr);
        isStartingRef.current = false;
        setError(normalized);
        updateState("error");
        callbacksRef.current.onError?.(normalized);
      };

      recognition.onend = () => {
        isStartingRef.current = false;
        const currentEndState = currentStateRef.current;

        // If stopped cleanly, transition to completed then idle
        if (currentEndState === "listening" || currentEndState === "processing" || isStoppingRef.current) {
          const committed = accumulatedFinalRef.current.trim();
          if (committed && callbacksRef.current.onTranscriptFinalized) {
            callbacksRef.current.onTranscriptFinalized(committed);
          }
          setInterimTranscript("");
          updateState("completed");

          setTimeout(() => {
            if (currentStateRef.current === "completed") {
              updateState("idle");
            }
            isStoppingRef.current = false;
          }, 600);
        } else if (currentEndState !== "error") {
          updateState("idle");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      isStartingRef.current = false;
      const normalized = normalizeSpeechError(err?.message || "unknown");
      setError(normalized);
      updateState("error");
      callbacksRef.current.onError?.(normalized);
    }
  }, [continuous, interimResults, lang, cleanupRecognition, updateState]);

  return {
    isSupported,
    state,
    interimTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    reset,
    clearError,
  };
}
