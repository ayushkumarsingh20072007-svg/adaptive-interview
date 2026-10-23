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
  const isListeningIntendedRef = React.useRef<boolean>(false);
  const interimTranscriptRef = React.useRef<string>("");
  const accumulatedFinalRef = React.useRef<string>("");
  const callbacksRef = React.useRef({ onTranscriptFinalized, onError });
  const currentStateRef = React.useRef<SpeechRecognitionState>("idle");
  const restartTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const networkRetryCountRef = React.useRef<number>(0);

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
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
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
      isListeningIntendedRef.current = false;
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
    isListeningIntendedRef.current = false;
    cleanupRecognition();
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setFinalTranscript("");
    accumulatedFinalRef.current = "";
    setError(null);
    updateState(isSpeechRecognitionSupported() ? "idle" : "unsupported");
  }, [cleanupRecognition, updateState]);

  // Core factory to spawn and start speech recognition instance
  const createAndStartInstance = React.useCallback((): boolean => {
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
      return false;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartingRef.current = false;
        networkRetryCountRef.current = 0;
        updateState("listening");
      };

      recognition.onresult = (event: any) => {
        networkRetryCountRef.current = 0;
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

        interimTranscriptRef.current = interimText.trim();
        setInterimTranscript(interimText.trim());
      };

      recognition.onerror = (event: any) => {
        const rawErr = event?.error || "unknown";

        // "aborted" often fires during clean manual stop/reset or silence teardown
        if (rawErr === "aborted" || isStoppingRef.current) {
          return;
        }

        // "no-speech" happens routinely during normal pauses in speaking.
        // In continuous recording, do NOT abort the session or display a jarring error.
        if (rawErr === "no-speech") {
          if (isListeningIntendedRef.current) {
            // Keep listening state active; onend will smoothly reconnect
            return;
          }
        }

        // Transient network hiccups: allow retry if candidate is actively recording
        if (rawErr === "network" && isListeningIntendedRef.current && networkRetryCountRef.current < 2) {
          networkRetryCountRef.current++;
          return;
        }

        const normalized = normalizeSpeechError(rawErr);
        isStartingRef.current = false;
        isListeningIntendedRef.current = false;
        setError(normalized);
        updateState("error");
        callbacksRef.current.onError?.(normalized);
      };

      recognition.onend = () => {
        isStartingRef.current = false;

        // If candidate intentionally wants to keep listening (e.g. browser disconnected due to silence or timeout):
        // Automatically reconnect to maintain uninterrupted listening experience!
        if (isListeningIntendedRef.current && !isStoppingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (isListeningIntendedRef.current && !isStoppingRef.current) {
              try {
                createAndStartInstance();
              } catch {
                // Safe ignore on restart race
              }
            }
          }, 150);
          return;
        }

        // Candidate stopped intentionally or recognition finished
        const currentEndState = currentStateRef.current;
        if (currentEndState === "listening" || currentEndState === "processing" || isStoppingRef.current) {
          // Commit any leftover unfinalized speech (e.g. user was mid-sentence when clicking Stop)
          const pendingInterim = interimTranscriptRef.current.trim();
          if (pendingInterim && callbacksRef.current.onTranscriptFinalized) {
            callbacksRef.current.onTranscriptFinalized(pendingInterim);
          }
          setInterimTranscript("");
          interimTranscriptRef.current = "";
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
      return true;
    } catch (err: any) {
      isStartingRef.current = false;
      isListeningIntendedRef.current = false;
      const normalized = normalizeSpeechError(err?.message || "unknown");
      setError(normalized);
      updateState("error");
      callbacksRef.current.onError?.(normalized);
      return false;
    }
  }, [continuous, interimResults, lang, updateState]);

  const stopListening = React.useCallback(() => {
    const current = currentStateRef.current;
    if (current !== "listening" && current !== "requesting_permission") {
      return;
    }

    isListeningIntendedRef.current = false;
    isStoppingRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    updateState("processing");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    }

    // Flush any pending interim speech as final text so candidate's last words are never lost
    const pendingInterim = interimTranscriptRef.current.trim();
    if (pendingInterim && callbacksRef.current.onTranscriptFinalized) {
      callbacksRef.current.onTranscriptFinalized(pendingInterim);
    }
    setInterimTranscript("");
    interimTranscriptRef.current = "";

    updateState("completed");

    setTimeout(() => {
      if (currentStateRef.current === "completed") {
        updateState("idle");
      }
      isStoppingRef.current = false;
    }, 600);
  }, [updateState]);

  const startListening = React.useCallback(async () => {
    const current = currentStateRef.current;
    // Prevent duplicate sessions or starts while already listening or starting
    if (isStartingRef.current || current === "listening" || current === "requesting_permission") {
      return;
    }

    if (!isSpeechRecognitionSupported()) {
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
    isListeningIntendedRef.current = true;
    isStoppingRef.current = false;
    updateState("requesting_permission");
    setError(null);
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setFinalTranscript("");
    accumulatedFinalRef.current = "";

    // Pre-request microphone permission in browser if available (essential for deployed HTTPS sites)
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          isStartingRef.current = false;
          isListeningIntendedRef.current = false;
          const normalized = normalizeSpeechError("not-allowed");
          setError(normalized);
          updateState("error");
          callbacksRef.current.onError?.(normalized);
          return;
        }
        // Other errors (e.g. NotFoundError): continue to SpeechRecognition to get standard error
      }
    }

    // If cancelled while permission was being requested
    if (!isListeningIntendedRef.current) {
      isStartingRef.current = false;
      updateState("idle");
      return;
    }

    createAndStartInstance();
  }, [cleanupRecognition, createAndStartInstance, updateState]);

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
