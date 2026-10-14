/**
 * InterviewIQ — Speech Recognition Abstraction (Web Speech API)
 * 
 * Provides safe browser feature detection, typed recognition states,
 * error normalization, and test mock injection for candidate voice input.
 * 
 * BROWSER COMPATIBILITY LIMITATIONS:
 * - Chrome / Edge: Full native support via webkitSpeechRecognition (online speech recognition service).
 * - Safari (macOS/iOS): Supported via webkitSpeechRecognition (requires network connection to Apple servers).
 * - Firefox: Web Speech Recognition API is NOT supported by default (requires media.webspeech.recognition.enable flag).
 * - Brave: May block Web Speech API by default depending on Shields settings.
 * - Mobile Browsers: Behavior depends on OS speech recognition service availability.
 * - Privacy Notice: Web Speech API transcribes speech using vendor browser services (e.g. Google on Chrome, Apple on Safari).
 *   Audio is not recorded or stored by InterviewIQ, but vendor speech service policies apply.
 */

export type SpeechRecognitionState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "completed"
  | "error"
  | "unsupported";

export type SpeechRecognitionErrorCode =
  | "not_allowed"
  | "no_speech"
  | "audio_capture"
  | "network"
  | "aborted"
  | "service_not_allowed"
  | "language_not_supported"
  | "unknown";

export interface SpeechRecognitionErrorDetails {
  code: SpeechRecognitionErrorCode;
  rawError?: string;
  message: string;
  actionableHint: string;
}

/**
 * Standard Web Speech API Recognition Interface
 */
export interface IBrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: IBrowserSpeechRecognition, ev: any) => any) | null;
  onnomatch: ((this: IBrowserSpeechRecognition, ev: any) => any) | null;
  onerror: ((this: IBrowserSpeechRecognition, ev: any) => any) | null;
  onstart: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
  onend: ((this: IBrowserSpeechRecognition, ev: Event) => any) | null;
}

export type SpeechRecognitionConstructor = new () => IBrowserSpeechRecognition;

// Test hook mock injection holder
let mockSpeechRecognitionCtor: SpeechRecognitionConstructor | null = null;

/**
 * Inject mock SpeechRecognition constructor for deterministic automated testing
 */
export function setMockSpeechRecognition(ctor: SpeechRecognitionConstructor | null): void {
  mockSpeechRecognitionCtor = ctor;
}

/**
 * Get currently active SpeechRecognition mock (if injected)
 */
export function getMockSpeechRecognition(): SpeechRecognitionConstructor | null {
  return mockSpeechRecognitionCtor;
}

/**
 * Check if the browser or runtime environment supports speech recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (mockSpeechRecognitionCtor !== null) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Obtain the SpeechRecognition constructor from window or active test mock
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (mockSpeechRecognitionCtor !== null) {
    return mockSpeechRecognitionCtor;
  }
  if (typeof window === "undefined") {
    return null;
  }
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/**
 * Normalize Web Speech API error events into friendly, actionable candidate messages
 */
export function normalizeSpeechError(eventError: string): SpeechRecognitionErrorDetails {
  switch (eventError) {
    case "not-allowed":
      return {
        code: "not_allowed",
        rawError: eventError,
        message: "Microphone access was denied.",
        actionableHint: "Please allow microphone permissions in your browser address bar to use voice input, or continue typing your answer.",
      };
    case "no-speech":
      return {
        code: "no_speech",
        rawError: eventError,
        message: "No speech was detected.",
        actionableHint: "Check your microphone input or speak a bit closer to your device.",
      };
    case "audio-capture":
      return {
        code: "audio_capture",
        rawError: eventError,
        message: "No microphone was found or audio capture failed.",
        actionableHint: "Verify that your microphone is plugged in, enabled in your system settings, and not in use by another application.",
      };
    case "network":
      return {
        code: "network",
        rawError: eventError,
        message: "Network connection required for speech recognition.",
        actionableHint: "Browser voice transcription requires an active internet connection. Please verify your connection or type your answer.",
      };
    case "service-not-allowed":
      return {
        code: "service_not_allowed",
        rawError: eventError,
        message: "Speech recognition service is blocked.",
        actionableHint: "Your browser or device has restricted access to cloud speech transcription.",
      };
    case "language-not-supported":
      return {
        code: "language_not_supported",
        rawError: eventError,
        message: "Selected recognition language is not supported.",
        actionableHint: "Your browser does not support voice transcription for this language setting.",
      };
    case "aborted":
      return {
        code: "aborted",
        rawError: eventError,
        message: "Speech recognition was stopped.",
        actionableHint: "Voice input was stopped.",
      };
    default:
      return {
        code: "unknown",
        rawError: eventError,
        message: "Speech recognition encountered an unexpected issue.",
        actionableHint: "You can try clicking the microphone again, or continue typing your answer directly.",
      };
  }
}

/**
 * Format and append recognized speech to existing typed content with sensible punctuation and spacing
 */
export function appendSpeechToAnswer(existingText: string, newSpeech: string): string {
  const trimmedSpeech = newSpeech.trim();
  if (!trimmedSpeech) {
    return existingText;
  }

  if (!existingText.trim()) {
    return trimmedSpeech.charAt(0).toUpperCase() + trimmedSpeech.slice(1);
  }

  const hasTrailingNewline = existingText.endsWith("\n");
  const trimmedEnd = existingText.trimEnd();
  const lastChar = trimmedEnd.slice(-1);
  const isSentenceEnd = lastChar === "." || lastChar === "!" || lastChar === "?";

  let formattedSpeech = trimmedSpeech;
  if (isSentenceEnd || hasTrailingNewline) {
    formattedSpeech = formattedSpeech.charAt(0).toUpperCase() + formattedSpeech.slice(1);
  }

  if (hasTrailingNewline) {
    return `${existingText}${formattedSpeech}`;
  }

  return `${trimmedEnd} ${formattedSpeech}`;
}
