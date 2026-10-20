/**
 * InterviewIQ Browser-Side Camera & Face Detection Engine
 *
 * Implements local-only multi-face classification and presence verification.
 * - Detects and classifies: "no_face" | "single_face" | "multiple_faces" | "detector_unavailable"
 * - Zero frame persistence: Processes frames strictly in memory; never uploads or stores raw frames.
 * - No biometric identity matching, face recognition, emotion detection or demographic inference.
 * - Multi-tier architecture: Native FaceDetector API -> MediaPipe/Canvas Analyzer -> Safe Fallback.
 * - Throttled sampling with configurable consecutive confirmation threshold.
 */

export type FaceDetectionState =
  | "no_face"
  | "single_face"
  | "multiple_faces"
  | "detector_unavailable";

export type DetectionEngineMethod =
  | "native_face_detector"
  | "mediapipe_vision"
  | "canvas_feature_analyzer"
  | "mock"
  | "unavailable";

export interface FaceDetectionResult {
  state: FaceDetectionState;
  faceCount: number;
  timestamp: number;
  method: DetectionEngineMethod;
  confidence?: number;
  message?: string;
}

export interface FaceDetectorConfig {
  /** How often (in ms) to sample and evaluate video frames (default: 1000ms / 1Hz) */
  samplingIntervalMs?: number;
  /** Number of consecutive multiple-face detections required to trigger warning/verification (default: 3) */
  consecutiveMultipleThreshold?: number;
  /** Number of consecutive no-face detections required to trigger missing-face warning (default: 3) */
  consecutiveMissingThreshold?: number;
  /** Verification countdown window in seconds when multiple faces persist (default: 10) */
  multipleFaceVerificationWindowSec?: number;
  /** Grace period countdown in seconds when no face is detected (default: 15) */
  missingFaceGracePeriodSec?: number;
  /** Optional custom detector function (useful for automated testing) */
  customDetector?: (video: HTMLVideoElement | HTMLCanvasElement) => Promise<FaceDetectionResult>;
}

export const DEFAULT_CONFIG: Required<Omit<FaceDetectorConfig, "customDetector">> = {
  samplingIntervalMs: 1000,
  consecutiveMultipleThreshold: 3,
  consecutiveMissingThreshold: 3,
  multipleFaceVerificationWindowSec: 10,
  missingFaceGracePeriodSec: 15,
};

// Global mock detector hook for CI / automated headless testing
let activeMockDetector: ((video: HTMLVideoElement | HTMLCanvasElement) => Promise<FaceDetectionResult>) | null = null;

export function setMockFaceDetector(
  fn: ((video: HTMLVideoElement | HTMLCanvasElement) => Promise<FaceDetectionResult>) | null
) {
  activeMockDetector = fn;
}

export function getMockFaceDetector() {
  return activeMockDetector;
}

/**
 * Native Shape Detection API (available in Chromium browsers)
 */
async function detectWithNativeApi(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
  if (typeof window === "undefined") return null;

  const FaceDetectorClass = (window as unknown as { FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> } }).FaceDetector;

  if (typeof FaceDetectorClass !== "function") {
    return null;
  }

  try {
    const detector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 5 });
    const faces = await detector.detect(video);
    const count = faces.length;

    let state: FaceDetectionState = "no_face";
    if (count === 1) state = "single_face";
    else if (count > 1) state = "multiple_faces";

    return {
      state,
      faceCount: count,
      timestamp: Date.now(),
      method: "native_face_detector",
    };
  } catch (err) {
    console.warn("[FaceDetector] Native detector error, falling back:", err);
    return null;
  }
}

/**
 * Local Canvas-based Visual Feature Analyzer
 * Evaluates downsampled (160x120) video frames in memory.
 * Analyzes skin-tone chroma clusters (YCbCr color space) and spatial connected components
 * to classify the presence of 0, 1, or multiple independent face regions.
 */
function detectWithCanvasAnalyzer(
  video: HTMLVideoElement,
  offscreenCanvas?: HTMLCanvasElement
): FaceDetectionResult {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return {
      state: "detector_unavailable",
      faceCount: 0,
      timestamp: Date.now(),
      method: "canvas_feature_analyzer",
      message: "Video track not ready or empty",
    };
  }

  try {
    const canvas = offscreenCanvas || document.createElement("canvas");
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return {
        state: "detector_unavailable",
        faceCount: 0,
        timestamp: Date.now(),
        method: "unavailable",
      };
    }

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Skin-tone mask based on YCbCr chromaticity bounds
    // Typical human skin: Y in [40, 240], Cb in [77, 127], Cr in [133, 173]
    const skinMask = new Uint8Array(width * height);
    let skinPixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      if (y >= 35 && y <= 245 && cb >= 77 && cb <= 128 && cr >= 130 && cr <= 175) {
        // Basic ratio check: skin R > G > B in normal lighting
        if (r > g && g > b && r - g > 10) {
          skinMask[i / 4] = 1;
          skinPixelCount++;
        }
      }
    }

    // If total skin pixels are negligible, no face is present
    const minFacePixels = 180; // ~1% of 160x120
    if (skinPixelCount < minFacePixels) {
      return {
        state: "no_face",
        faceCount: 0,
        timestamp: Date.now(),
        method: "canvas_feature_analyzer",
      };
    }

    // Group skin pixels into vertical quadrant columns to test for multiple distinct heads/faces
    // Divide the frame horizontally into 8 columns
    const numCols = 8;
    const colDensity = new Array(numCols).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (skinMask[y * width + x] === 1) {
          const col = Math.floor((x / width) * numCols);
          colDensity[col]++;
        }
      }
    }

    // Find local peaks in horizontal density separated by a valley (indicating separate people)
    const threshold = minFacePixels * 0.35;
    const peaks: number[] = [];

    for (let c = 0; c < numCols; c++) {
      if (colDensity[c] > threshold) {
        const left = c > 0 ? colDensity[c - 1] : 0;
        const right = c < numCols - 1 ? colDensity[c + 1] : 0;
        if (colDensity[c] >= left && colDensity[c] >= right) {
          peaks.push(c);
        }
      }
    }

    // Count distinct peaks with separation of at least 2 columns
    let distinctFaces = 0;
    let lastPeak = -99;
    for (const p of peaks) {
      if (p - lastPeak >= 2) {
        distinctFaces++;
        lastPeak = p;
      }
    }

    if (distinctFaces === 0 && skinPixelCount >= minFacePixels) {
      distinctFaces = 1;
    }

    let state: FaceDetectionState = "no_face";
    if (distinctFaces === 1) state = "single_face";
    else if (distinctFaces > 1) state = "multiple_faces";

    return {
      state,
      faceCount: distinctFaces,
      timestamp: Date.now(),
      method: "canvas_feature_analyzer",
    };
  } catch (err) {
    console.warn("[FaceDetector] Canvas analyzer error:", err);
    return {
      state: "detector_unavailable",
      faceCount: 0,
      timestamp: Date.now(),
      method: "unavailable",
      message: (err as Error).message,
    };
  }
}

/**
 * Execute a single face detection check on the active video element.
 */
export async function detectFacesInVideo(
  video: HTMLVideoElement,
  customDetector?: (video: HTMLVideoElement | HTMLCanvasElement) => Promise<FaceDetectionResult>
): Promise<FaceDetectionResult> {
  // 1. Mock detector (for testing)
  if (customDetector) {
    return await customDetector(video);
  }
  if (activeMockDetector) {
    return await activeMockDetector(video);
  }

  // 2. Native Shape Detection API (if supported by browser)
  const nativeResult = await detectWithNativeApi(video);
  if (nativeResult) {
    return nativeResult;
  }

  // 3. Fallback: Local Canvas Visual Analyzer
  return detectWithCanvasAnalyzer(video);
}

/**
 * State machine filter to track consecutive detection states.
 * Guarantees that transient 1-2 frame spikes NEVER immediately abandon or warn.
 */
export class ConsecutiveDetectionTracker {
  private consecutiveMultipleCount = 0;
  private consecutiveMissingCount = 0;
  private consecutiveSingleCount = 0;
  private lastConfirmedState: FaceDetectionState = "single_face";

  private readonly requiredMultipleThreshold: number;
  private readonly requiredMissingThreshold: number;

  constructor(
    requiredMultipleThreshold = 3,
    requiredMissingThreshold = 3
  ) {
    this.requiredMultipleThreshold = requiredMultipleThreshold;
    this.requiredMissingThreshold = requiredMissingThreshold;
  }

  public process(result: FaceDetectionResult): {
    currentState: FaceDetectionState;
    confirmedState: FaceDetectionState;
    consecutiveMultiple: number;
    consecutiveMissing: number;
    isMultiplePersistent: boolean;
    isMissingPersistent: boolean;
  } {
    const rawState = result.state;

    if (rawState === "multiple_faces") {
      this.consecutiveMultipleCount++;
      this.consecutiveMissingCount = 0;
      this.consecutiveSingleCount = 0;
    } else if (rawState === "no_face") {
      this.consecutiveMissingCount++;
      this.consecutiveMultipleCount = 0;
      this.consecutiveSingleCount = 0;
    } else if (rawState === "single_face") {
      this.consecutiveSingleCount++;
      this.consecutiveMultipleCount = 0;
      this.consecutiveMissingCount = 0;
      this.lastConfirmedState = "single_face";
    } else {
      // detector_unavailable
      this.consecutiveMultipleCount = 0;
      this.consecutiveMissingCount = 0;
    }

    const isMultiplePersistent = this.consecutiveMultipleCount >= this.requiredMultipleThreshold;
    const isMissingPersistent = this.consecutiveMissingCount >= this.requiredMissingThreshold;

    let confirmedState: FaceDetectionState = this.lastConfirmedState;
    if (isMultiplePersistent) {
      confirmedState = "multiple_faces";
      this.lastConfirmedState = "multiple_faces";
    } else if (isMissingPersistent) {
      confirmedState = "no_face";
      this.lastConfirmedState = "no_face";
    } else if (this.consecutiveSingleCount >= 1) {
      confirmedState = "single_face";
      this.lastConfirmedState = "single_face";
    }

    return {
      currentState: rawState,
      confirmedState,
      consecutiveMultiple: this.consecutiveMultipleCount,
      consecutiveMissing: this.consecutiveMissingCount,
      isMultiplePersistent,
      isMissingPersistent,
    };
  }

  public reset() {
    this.consecutiveMultipleCount = 0;
    this.consecutiveMissingCount = 0;
    this.consecutiveSingleCount = 0;
    this.lastConfirmedState = "single_face";
  }
}
