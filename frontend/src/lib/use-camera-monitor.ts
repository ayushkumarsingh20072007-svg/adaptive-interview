"use client";

import * as React from "react";
import {
  FaceDetectionState,
  FaceDetectionResult,
  FaceDetectorConfig,
  DEFAULT_CONFIG,
  ConsecutiveDetectionTracker,
  detectFacesInVideo,
} from "@/lib/face-detection";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export interface CameraMonitorState {
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  stream: MediaStream | null;
  detectionState: FaceDetectionState;
  faceCount: number;
  isVerifyingMultiple: boolean;
  multipleVerificationRemainingSec: number;
  isMissingFaceGraceActive: boolean;
  missingFaceGraceRemainingSec: number;
  detectorCrashed: boolean;
}

export type CameraMonitorEvent =
  | { type: "camera_missing_face"; gracePeriodSec: number; idempotencyKey: string }
  | {
      type: "camera_multiple_faces";
      faceCount: number;
      persistedSec: number;
      idempotencyKey: string;
      forceTerminate?: boolean;
      metadata?: string;
    }
  | { type: "camera_detector_crashed" }
  | { type: "camera_detector_recovered" };

export interface UseCameraMonitorOptions {
  /** Whether monitoring is enabled (false means never activate camera) */
  enabled: boolean;
  /** Session ID for correlation */
  sessionId: string;
  /** Whether interview policy has been acknowledged */
  integrityAcknowledged: boolean;
  /** Whether interview is already terminated or completed */
  isTerminated: boolean;
  /** Face detection config overrides */
  config?: FaceDetectorConfig;
  /** Called when a monitorable event occurs that needs persistence */
  onIntegrityEvent?: (event: CameraMonitorEvent) => void;
  /** Whether camera is mandatory (block start if fails) */
  cameraMandatory?: boolean;
}

/**
 * useCameraMonitor
 *
 * Manages the full camera lifecycle for interview integrity monitoring:
 * 1. Never requests camera before the interview is explicitly started
 * 2. Requests getUserMedia ONLY after integrityAcknowledged becomes true
 * 3. Runs face detection at configurable intervals in-browser, no frame persistence
 * 4. Tracks consecutive detection states using ConsecutiveDetectionTracker
 * 5. Runs per-state countdowns (grace periods, verification windows)
 * 6. Fires onIntegrityEvent callbacks for upstream persistence
 * 7. Stops ALL camera tracks on unmount, termination or disabling
 */
export function useCameraMonitor(opts: UseCameraMonitorOptions): CameraMonitorState & {
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  retryCamera: () => Promise<void>;
} {
  const {
    enabled,
    sessionId,
    integrityAcknowledged,
    isTerminated,
    config: configOverrides = {},
    onIntegrityEvent,
  } = opts;

  const config = React.useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [state, setState] = React.useState<CameraMonitorState>({
    cameraStatus: "idle",
    errorMessage: null,
    stream: null,
    detectionState: "single_face",
    faceCount: 0,
    isVerifyingMultiple: false,
    multipleVerificationRemainingSec: 0,
    isMissingFaceGraceActive: false,
    missingFaceGraceRemainingSec: 0,
    detectorCrashed: false,
  });

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<ConsecutiveDetectionTracker>(
    new ConsecutiveDetectionTracker(
      config.consecutiveMultipleThreshold,
      config.consecutiveMissingThreshold
    )
  );

  // Countdown references for verification/grace periods
  const multipleCountdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const missingCountdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const samplingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard against duplicate termination events
  const terminationFiredRef = React.useRef(false);
  // Guard against issuing multiple grace-period started events
  const missingGraceStartedRef = React.useRef(false);
  const multipleVerifyStartedRef = React.useRef(false);
  const detectorCrashedRef = React.useRef(false);

  const stopCountdowns = React.useCallback(() => {
    if (multipleCountdownRef.current) {
      clearInterval(multipleCountdownRef.current);
      multipleCountdownRef.current = null;
    }
    if (missingCountdownRef.current) {
      clearInterval(missingCountdownRef.current);
      missingCountdownRef.current = null;
    }
  }, []);

  const stopCamera = React.useCallback(() => {
    // Stop detection sampling
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
    stopCountdowns();

    // Release all camera media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Detach from video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState((prev) => ({
      ...prev,
      cameraStatus: "idle",
      stream: null,
      detectionState: "single_face",
      faceCount: 0,
      isVerifyingMultiple: false,
      multipleVerificationRemainingSec: 0,
      isMissingFaceGraceActive: false,
      missingFaceGraceRemainingSec: 0,
      detectorCrashed: false,
    }));

    detectorRef.current.reset();
    terminationFiredRef.current = false;
    missingGraceStartedRef.current = false;
    multipleVerifyStartedRef.current = false;
    detectorCrashedRef.current = false;
  }, [stopCountdowns]);

  const startMultipleVerificationCountdown = React.useCallback(() => {
    if (multipleVerifyStartedRef.current) return;
    multipleVerifyStartedRef.current = true;

    let remaining = config.multipleFaceVerificationWindowSec;
    setState((prev) => ({
      ...prev,
      isVerifyingMultiple: true,
      multipleVerificationRemainingSec: remaining,
    }));

    if (multipleCountdownRef.current) {
      clearInterval(multipleCountdownRef.current);
    }

    multipleCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setState((prev) => ({
        ...prev,
        multipleVerificationRemainingSec: Math.max(0, remaining),
      }));

      if (remaining <= 0) {
        if (multipleCountdownRef.current) {
          clearInterval(multipleCountdownRef.current);
          multipleCountdownRef.current = null;
        }

        // Verification window expired with multiple faces still present → terminate
        if (!terminationFiredRef.current) {
          terminationFiredRef.current = true;
          const idempotencyKey = `cam_multi_terminate_${sessionId}_${Date.now()}`;
          onIntegrityEvent?.({
            type: "camera_multiple_faces",
            faceCount: 2, // at minimum 2 faces were confirmed
            persistedSec: config.multipleFaceVerificationWindowSec,
            idempotencyKey,
            forceTerminate: true,
            metadata: JSON.stringify({
              detectionMethod: "consecutive_threshold",
              threshold: config.consecutiveMultipleThreshold,
              verificationWindowSec: config.multipleFaceVerificationWindowSec,
            }),
          });
        }
      }
    }, 1000);
  }, [config, sessionId, onIntegrityEvent]);

  const startMissingFaceGrace = React.useCallback(() => {
    if (missingGraceStartedRef.current) return;
    missingGraceStartedRef.current = true;

    let remaining = config.missingFaceGracePeriodSec;
    setState((prev) => ({
      ...prev,
      isMissingFaceGraceActive: true,
      missingFaceGraceRemainingSec: remaining,
    }));

    if (missingCountdownRef.current) {
      clearInterval(missingCountdownRef.current);
    }

    missingCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setState((prev) => ({
        ...prev,
        missingFaceGraceRemainingSec: Math.max(0, remaining),
      }));

      if (remaining <= 0) {
        if (missingCountdownRef.current) {
          clearInterval(missingCountdownRef.current);
          missingCountdownRef.current = null;
        }

        // Grace period expired → fire non-terminating warning event
        const idempotencyKey = `cam_missing_${sessionId}_${Date.now()}`;
        onIntegrityEvent?.({
          type: "camera_missing_face",
          gracePeriodSec: config.missingFaceGracePeriodSec,
          idempotencyKey,
        });
      }
    }, 1000);
  }, [config, sessionId, onIntegrityEvent]);

  const runDetectionCycle = React.useCallback(async () => {
    const video = videoRef.current;
    if (
      !video ||
      !streamRef.current ||
      video.readyState < 2 ||
      isTerminated ||
      terminationFiredRef.current
    ) {
      return;
    }

    let result: FaceDetectionResult;
    try {
      // Pass custom detector from face-detection module (supports mocking in tests)
      const { getMockFaceDetector } = await import("@/lib/face-detection");
      const mockDetector = getMockFaceDetector();
      result = await detectFacesInVideo(video, mockDetector ?? undefined);
    } catch (err) {
      console.warn("[CameraMonitor] Detection error:", err);
      result = {
        state: "detector_unavailable",
        faceCount: 0,
        timestamp: Date.now(),
        method: "unavailable",
        message: (err as Error)?.message,
      };
    }

    if (result.state === "detector_unavailable" && !detectorCrashedRef.current) {
      // Detector became unavailable – fail safe, fire event, do NOT immediately terminate
      detectorCrashedRef.current = true;
      setState((prev) => ({
        ...prev,
        detectionState: "detector_unavailable",
        detectorCrashed: true,
      }));
      onIntegrityEvent?.({ type: "camera_detector_crashed" });
      return;
    }

    if (result.state !== "detector_unavailable" && detectorCrashedRef.current) {
      // Detector recovered
      detectorCrashedRef.current = false;
      setState((prev) => ({ ...prev, detectorCrashed: false }));
      onIntegrityEvent?.({ type: "camera_detector_recovered" });
    }

    const evaluation = detectorRef.current.process(result);

    setState((prev) => ({
      ...prev,
      detectionState: evaluation.confirmedState,
      faceCount: result.faceCount,
    }));

    if (evaluation.confirmedState === "single_face") {
      // Reset all countdowns / guard flags on good detection
      stopCountdowns();
      missingGraceStartedRef.current = false;
      multipleVerifyStartedRef.current = false;
      setState((prev) => ({
        ...prev,
        isVerifyingMultiple: false,
        multipleVerificationRemainingSec: 0,
        isMissingFaceGraceActive: false,
        missingFaceGraceRemainingSec: 0,
      }));
    } else if (evaluation.isMultiplePersistent && !terminationFiredRef.current) {
      startMultipleVerificationCountdown();
    } else if (evaluation.isMissingPersistent) {
      startMissingFaceGrace();
    }
  }, [isTerminated, stopCountdowns, startMultipleVerificationCountdown, startMissingFaceGrace, onIntegrityEvent]);

  const startCamera = React.useCallback(async () => {
    if (!enabled || typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        cameraStatus: "unavailable",
        errorMessage: "This browser does not support camera access.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, cameraStatus: "requesting", errorMessage: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;

      // Create a hidden video element for frame sampling (detached from UI)
      if (!videoRef.current) {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.setAttribute("aria-hidden", "true");
        videoRef.current = v;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      setState((prev) => ({ ...prev, cameraStatus: "active", stream, errorMessage: null }));

      // Start periodic face-detection sampling
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }
      samplingIntervalRef.current = setInterval(runDetectionCycle, config.samplingIntervalMs);

      // Run first detection immediately
      setTimeout(runDetectionCycle, 500);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState((prev) => ({
          ...prev,
          cameraStatus: "denied",
          errorMessage: "Camera access was denied. Please allow camera access to continue.",
        }));
      } else if (
        name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "NotReadableError"
      ) {
        setState((prev) => ({
          ...prev,
          cameraStatus: "unavailable",
          errorMessage: "No camera device found. Please connect a camera and try again.",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          cameraStatus: "error",
          errorMessage: `Camera initialization failed: ${err.message || "Unknown error"}`,
        }));
      }
    }
  }, [enabled, runDetectionCycle, config.samplingIntervalMs]);

  const retryCamera = React.useCallback(async () => {
    stopCamera();
    await new Promise((r) => setTimeout(r, 200));
    await startCamera();
  }, [stopCamera, startCamera]);

  // Auto-start camera only AFTER policy is acknowledged and interview is active
  // Never activate before an explicit candidate action
  React.useEffect(() => {
    if (!enabled || !integrityAcknowledged || isTerminated) {
      return;
    }
    if (state.cameraStatus === "idle") {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, integrityAcknowledged, isTerminated]);

  // Stop all tracks when interview ends or component unmounts
  React.useEffect(() => {
    if (isTerminated && streamRef.current) {
      stopCamera();
    }
  }, [isTerminated, stopCamera]);

  // Cleanup on component unmount (covers navigation away, browser close, etc.)
  React.useEffect(() => {
    return () => {
      if (samplingIntervalRef.current) clearInterval(samplingIntervalRef.current);
      stopCountdowns();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stopCountdowns]);

  return {
    ...state,
    startCamera,
    stopCamera,
    retryCamera,
  };
}
