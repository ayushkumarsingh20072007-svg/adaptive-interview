"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaceDetectionState } from "@/lib/face-detection";

export interface CameraPreviewProps {
  stream: MediaStream | null;
  cameraStatus: "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";
  errorMessage?: string | null;
  detectionState: FaceDetectionState;
  faceCount?: number;
  isVerifyingMultiple: boolean;
  multipleVerificationRemainingSec: number;
  isMissingFaceGraceActive: boolean;
  missingFaceGraceRemainingSec: number;
  detectorCrashed?: boolean;
  onRetry?: () => void;
  /** @deprecated use onRetry */
  onRetryPermission?: () => void;
  onStartCamera?: () => void;
  onStopCamera?: () => void;
  compact?: boolean;
}

export function CameraPreview({
  stream,
  cameraStatus,
  errorMessage,
  detectionState,
  faceCount = 0,
  isVerifyingMultiple,
  multipleVerificationRemainingSec,
  isMissingFaceGraceActive,
  missingFaceGraceRemainingSec,
  detectorCrashed = false,
  onRetry,
  onRetryPermission,
  onStartCamera,
  onStopCamera,
  compact = false,
}: CameraPreviewProps) {
  const handleRetry = onRetry ?? onRetryPermission;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Bind media stream to video element
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.play().catch((err) => {
        console.warn("[CameraPreview] Autoplay prevented or aborted:", err);
      });
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // Status badge meta
  const statusMeta = React.useMemo(() => {
    if (cameraStatus === "requesting") {
      return {
        label: "Initializing Camera...",
        variant: "indigo" as const,
        icon: <RefreshCw className="h-3 w-3 animate-spin" />,
        borderColor: "border-indigo-500/30",
      };
    }
    if (cameraStatus === "denied") {
      return {
        label: "Camera Access Denied",
        variant: "danger" as const,
        icon: <CameraOff className="h-3 w-3" />,
        borderColor: "border-rose-500/50",
      };
    }
    if (cameraStatus === "unavailable" || cameraStatus === "error") {
      return {
        label: "Camera Unavailable",
        variant: "warning" as const,
        icon: <AlertTriangle className="h-3 w-3" />,
        borderColor: "border-amber-500/50",
      };
    }
    if (cameraStatus === "idle") {
      return {
        label: "Camera Inactive",
        variant: "default" as const,
        icon: <Camera className="h-3 w-3 text-slate-400" />,
        borderColor: "border-slate-800/80",
      };
    }

    // Active status based on face detection classification
    if (detectionState === "multiple_faces") {
      return {
        label: isVerifyingMultiple
          ? `Multiple Faces (${multipleVerificationRemainingSec}s)`
          : `Multiple Faces (${faceCount})`,
        variant: "danger" as const,
        icon: <Users className="h-3 w-3" />,
        borderColor: "border-rose-500/60 shadow-rose-950/40",
      };
    }
    if (detectionState === "no_face") {
      return {
        label: isMissingFaceGraceActive
          ? `No Face (${missingFaceGraceRemainingSec}s)`
          : "No Face Detected",
        variant: "warning" as const,
        icon: <UserX className="h-3 w-3" />,
        borderColor: "border-amber-500/60 shadow-amber-950/40",
      };
    }
    if (detectionState === "detector_unavailable") {
      return {
        label: "Detector Paused",
        variant: "warning" as const,
        icon: <AlertTriangle className="h-3 w-3" />,
        borderColor: "border-amber-500/40",
      };
    }

    return {
      label: "Active (1 Face)",
      variant: "success" as const,
      icon: <UserCheck className="h-3 w-3" />,
      borderColor: "border-emerald-500/40 shadow-emerald-950/30",
    };
  }, [
    cameraStatus,
    detectionState,
    faceCount,
    isVerifyingMultiple,
    multipleVerificationRemainingSec,
    isMissingFaceGraceActive,
    missingFaceGraceRemainingSec,
  ]);

  return (
    <div
      className={`relative rounded-2xl border ${statusMeta.borderColor} bg-[#080d1a]/95 backdrop-blur-md overflow-hidden shadow-lg transition-all duration-300 ${
        isExpanded ? "w-80" : "w-full"
      }`}
      aria-labelledby="camera-status-heading"
    >
      {/* Video Viewport */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {stream && cameraStatus === "active" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
            aria-label="Live camera preview for interview integrity"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
            {cameraStatus === "denied" ? (
              <>
                <div className="h-10 w-10 rounded-full bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400">
                  <CameraOff className="h-5 w-5" />
                </div>
                <p className="text-xs text-rose-300 font-semibold">Camera Access Blocked</p>
                <p className="text-[11px] text-slate-400 max-w-[200px]">
                  Please allow camera access in your browser settings to proceed.
                </p>
                {handleRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="text-xs h-7 px-2.5 mt-1 border-rose-800/60 text-rose-300 hover:bg-rose-950"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </>
            ) : cameraStatus === "unavailable" || cameraStatus === "error" ? (
              <>
                <div className="h-10 w-10 rounded-full bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-xs text-amber-300 font-semibold">Camera Not Found</p>
                <p className="text-[11px] text-slate-400 max-w-[200px]">
                  {errorMessage || "No compatible camera device detected."}
                </p>
                {handleRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="text-xs h-7 px-2.5 mt-1 border-amber-800/60 text-amber-300 hover:bg-amber-950"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-3 text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-200 font-semibold">Proctoring Camera</p>
                  <p className="text-[11px] text-slate-400 max-w-[210px] mt-0.5">
                    Camera monitoring verifies candidate presence during the technical interview.
                  </p>
                </div>
                {onStartCamera && (
                  <Button
                    size="sm"
                    onClick={onStartCamera}
                    className="text-xs h-7 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1.5 shadow-sm mt-1"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Turn On Camera
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top-right overlay buttons */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded-md bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white backdrop-blur-sm transition-colors text-[10px]"
            title={isExpanded ? "Collapse preview" : "Expand preview"}
            aria-label={isExpanded ? "Collapse preview" : "Expand preview"}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>

        {/* Real-time Face Status HUD Indicator on Preview */}
        {cameraStatus === "active" && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md flex items-center gap-1 ${
                detectionState === "multiple_faces"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-700/60 animate-pulse"
                  : detectionState === "no_face"
                  ? "bg-amber-950/80 text-amber-300 border border-amber-700/60"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
              }`}
            >
              {statusMeta.icon}
              {detectionState === "multiple_faces"
                ? `Multiple (${faceCount})`
                : detectionState === "no_face"
                ? "No face"
                : "1 face"}
            </span>

            <span className="text-[9px] text-slate-400 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
              Local AI
            </span>
          </div>
        )}
      </div>

      {/* Camera Status Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge variant={statusMeta.variant} className="text-[10px] py-0.5 px-2 gap-1 font-medium">
            {statusMeta.icon}
            <span id="camera-status-heading">{statusMeta.label}</span>
          </Badge>
        </div>

        <span className="text-[10px] text-slate-400 flex items-center gap-1" title="Privacy Protected: No raw video is recorded or stored.">
          <ShieldCheck className="h-3 w-3 text-indigo-400" />
          <span>Local Only</span>
        </span>
      </div>

      {/* Screen Reader ARIA Live Status Announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {detectionState === "multiple_faces" && isVerifyingMultiple
          ? `Alert: Multiple faces detected. Verification in progress, ${multipleVerificationRemainingSec} seconds remaining.`
          : detectionState === "no_face" && isMissingFaceGraceActive
          ? `Warning: No face detected. Grace period active, ${missingFaceGraceRemainingSec} seconds remaining.`
          : `Camera status: ${statusMeta.label}`}
      </div>
    </div>
  );
}
