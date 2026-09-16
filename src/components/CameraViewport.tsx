import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertTriangle, Monitor, SwitchCamera } from 'lucide-react';
import { BodyDimensions, GarmentItem, PoseKeypoints, FitEngineMode, SnapshotData } from '../lib/types';
import { poseEngine } from '../lib/poseDetector';
import { garmentFitter } from '../lib/garmentFitter';

interface CameraViewportProps {
  currentGarment: GarmentItem;
  customGarmentCanvas: HTMLCanvasElement | HTMLImageElement | null;
  selectedSize: string;
  opacity: number;
  wireframeOnly: boolean;
  fitEngine: FitEngineMode;
  showLandmarks: boolean;
  onDimensionsUpdate: (dims: BodyDimensions) => void;
  isSimulated: boolean;
  onToggleSimulator: (sim: boolean) => void;
  snapshotTrigger: number;
  onSnapshotCaptured: (data: SnapshotData) => void;
  facingMode?: 'user' | 'environment';
  onToggleFacingMode?: () => void;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  currentGarment,
  customGarmentCanvas,
  selectedSize,
  opacity,
  wireframeOnly,
  fitEngine,
  showLandmarks,
  onDimensionsUpdate,
  isSimulated,
  onToggleSimulator,
  snapshotTrigger,
  onSnapshotCaptured,
  facingMode = 'user',
  onToggleFacingMode
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(30);
  const [activeImageSource, setActiveImageSource] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);

  // Performance tracking
  const frameCountRef = useRef<number>(0);
  const lastFpsCheckRef = useRef<number>(performance.now());
  const lastKeypointsRef = useRef<PoseKeypoints | null>(null);
  const lastDimensionsRef = useRef<BodyDimensions | null>(null);

  // Preload garment texture
  useEffect(() => {
    if (customGarmentCanvas) {
      setActiveImageSource(customGarmentCanvas);
      return;
    }

    let isMounted = true;
    garmentFitter
      .preloadImage(currentGarment.imageUrl)
      .then((img) => {
        if (isMounted) setActiveImageSource(img);
      })
      .catch((err) => console.error('Failed to load garment texture:', err));

    return () => {
      isMounted = false;
    };
  }, [currentGarment, customGarmentCanvas]);

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    poseEngine.initialize();
  }, []);

  // Request Webcam Stream with dynamic facingMode
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser context.');
      }

      // Stop previous tracks if switching lenses
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          onToggleSimulator(false);
        };
      }
    } catch (err: any) {
      console.warn('Webcam stream unavailable or access denied:', err);
      setCameraError(err.message || 'Camera permission denied or camera device in use.');
      onToggleSimulator(true);
    }
  }, [facingMode, onToggleSimulator]);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }, []);

  // Handle stream lifecycle when mode or lens changes
  useEffect(() => {
    if (!isSimulated) {
      startWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isSimulated, facingMode, startWebcam, stopWebcam]);

  // Size Multiplier mapping for active garment
  const getSizeMultiplier = (size: string): number => {
    switch (size) {
      case 'XS':
        return 0.88;
      case 'S':
        return 0.94;
      case 'M':
        return 1.0;
      case 'L':
        return 1.07;
      case 'XL':
        return 1.14;
      case 'XXL':
        return 1.22;
      default:
        return 1.0;
    }
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isRunning = true;

    const renderLoop = (time: number) => {
      if (!isRunning) return;

      // Calculate FPS
      frameCountRef.current++;
      if (time - lastFpsCheckRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsCheckRef.current = time;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      let currentKeypoints: PoseKeypoints | null = null;
      let currentDimensions: BodyDimensions | null = null;

      // 1. Draw Background: Camera Feed or Studio Background
      if (!isSimulated && cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const isSelfie = facingMode === 'user';

        if (isSelfie) {
          // Mirror horizontally for natural mirror ergonomics
          ctx.save();
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, cw, ch);
          ctx.restore();
        } else {
          // Rear camera: draw directly without flipping
          ctx.drawImage(video, 0, 0, cw, ch);
        }

        // Detect real pose
        const det = poseEngine.detect(video, time);
        if (det.keypoints) {
          if (isSelfie) {
            // Because selfie video was mirrored, invert x keypoints so they align with the mirrored canvas
            const mirroredKeypoints: PoseKeypoints = {
              ...det.keypoints,
              leftShoulder: { ...det.keypoints.rightShoulder, x: 1 - det.keypoints.rightShoulder.x },
              rightShoulder: { ...det.keypoints.leftShoulder, x: 1 - det.keypoints.leftShoulder.x },
              leftHip: { ...det.keypoints.rightHip, x: 1 - det.keypoints.rightHip.x },
              rightHip: { ...det.keypoints.leftHip, x: 1 - det.keypoints.leftHip.x },
              neckBase: { ...det.keypoints.neckBase, x: 1 - det.keypoints.neckBase.x },
              midHip: { ...det.keypoints.midHip, x: 1 - det.keypoints.midHip.x },
              chestMid: { ...det.keypoints.chestMid, x: 1 - det.keypoints.chestMid.x },
              shoulderSlopeRad: -det.keypoints.shoulderSlopeRad
            };
            currentKeypoints = mirroredKeypoints;
          } else {
            currentKeypoints = det.keypoints;
          }
          currentDimensions = det.dimensions;
        }
      } else {
        // Studio Simulator Mode (Architectural deep slate canvas)
        ctx.fillStyle = '#0A0A0C';
        ctx.fillRect(0, 0, cw, ch);

        // Subtle studio grid rules
        ctx.strokeStyle = '#16171E';
        ctx.lineWidth = 1;
        const gridSize = 48;
        for (let x = 0; x < cw; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ch);
          ctx.stroke();
        }
        for (let y = 0; y < ch; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(cw, y);
          ctx.stroke();
        }

        // Draw synthetic mannequin silhouette
        const synth = poseEngine.getSyntheticPose(time / 1000);
        currentKeypoints = synth.keypoints;
        currentDimensions = synth.dimensions;

        // Draw soft mannequin body silhouette
        ctx.save();
        ctx.fillStyle = '#181A22';
        ctx.strokeStyle = '#272B36';
        ctx.lineWidth = 1.2;

        // Head
        ctx.beginPath();
        ctx.ellipse(currentKeypoints.neckBase.x * cw, currentKeypoints.neckBase.y * ch - 65, 30, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck
        ctx.beginPath();
        ctx.rect(currentKeypoints.neckBase.x * cw - 12, currentKeypoints.neckBase.y * ch - 35, 24, 35);
        ctx.fill();
        ctx.stroke();

        // Torso contour
        ctx.beginPath();
        const ls = { x: currentKeypoints.leftShoulder.x * cw, y: currentKeypoints.leftShoulder.y * ch };
        const rs = { x: currentKeypoints.rightShoulder.x * cw, y: currentKeypoints.rightShoulder.y * ch };
        const lh = { x: currentKeypoints.leftHip.x * cw, y: currentKeypoints.leftHip.y * ch };
        const rh = { x: currentKeypoints.rightHip.x * cw, y: currentKeypoints.rightHip.y * ch };

        ctx.moveTo(ls.x, ls.y);
        ctx.lineTo(rs.x, rs.y);
        ctx.lineTo(rh.x + 10, rh.y);
        ctx.lineTo(lh.x - 10, lh.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Update parent telemetry if dimensions changed
      if (currentDimensions) {
        lastDimensionsRef.current = currentDimensions;
        onDimensionsUpdate(currentDimensions);
      }

      // 2. Render Garment Warping Overlay
      if (currentKeypoints && activeImageSource) {
        lastKeypointsRef.current = currentKeypoints;
        garmentFitter.renderGarment(
          ctx,
          cw,
          ch,
          currentKeypoints,
          currentGarment,
          activeImageSource,
          {
            opacity,
            wireframeOnly,
            sizeMultiplier: getSizeMultiplier(selectedSize),
            fitEngine,
            showLandmarks
          }
        );
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    isSimulated,
    cameraActive,
    facingMode,
    activeImageSource,
    currentGarment,
    selectedSize,
    opacity,
    wireframeOnly,
    fitEngine,
    showLandmarks,
    onDimensionsUpdate
  ]);

  // Handle Snapshot trigger
  useEffect(() => {
    if (snapshotTrigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastDimensionsRef.current) return;

    // Export current frame
    const dataUrl = canvas.toDataURL('image/png');
    const snapshot: SnapshotData = {
      dataUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dimensions: lastDimensionsRef.current,
      garment: currentGarment,
      size: selectedSize,
      fitEngine
    };
    onSnapshotCaptured(snapshot);
  }, [snapshotTrigger, currentGarment, selectedSize, fitEngine, onSnapshotCaptured]);

  return (
    <div className="relative w-full h-full bg-[#0A0A0C] flex items-center justify-center overflow-hidden">
      {/* Hidden processing video element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
      />

      {/* Main High-Resolution Canvas Mirror */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-cover max-w-full max-h-full"
      />

      {/* Camera and Feed Status Badge (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap">
        <div className="bg-[#131418]/90 border border-[#222530] px-3 py-1.5 rounded flex items-center gap-2 backdrop-blur-sm text-[11px] font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              cameraActive ? 'bg-[#10B981]' : isSimulated ? 'bg-[#E2E8F0]' : 'bg-[#EF4444]'
            }`}
          />
          <span className="text-[#F5F5F7] tracking-wider uppercase font-semibold">
            {cameraActive
              ? `CAMERA: ${facingMode === 'user' ? 'FRONT' : 'REAR'}`
              : isSimulated
              ? 'SIMULATOR'
              : 'OFFLINE'}
          </span>
          <span className="text-[#3A3F52]">|</span>
          <span className="text-[#7E8294] tabular-nums">FPS: {fps}</span>
        </div>

        {/* Camera Lens Flip Button (Mobile Ergonomics) */}
        {!isSimulated && cameraActive && onToggleFacingMode && (
          <button
            onClick={onToggleFacingMode}
            title="Switch Front/Rear Camera"
            className="bg-[#131418]/90 hover:bg-[#1A1C23] border border-[#222530] hover:border-[#3A3F52] px-2.5 py-1.5 rounded text-[11px] font-mono text-[#F5F5F7] flex items-center gap-1.5 backdrop-blur-sm transition-colors cursor-pointer"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-[#E2E8F0]" />
            <span className="hidden sm:inline">Flip Lens</span>
          </button>
        )}

        {/* Simulator / Camera Mode Toggle Button */}
        <button
          onClick={() => {
            if (isSimulated) {
              startWebcam();
            } else {
              stopWebcam();
              onToggleSimulator(true);
            }
          }}
          className="bg-[#131418]/90 hover:bg-[#1A1C23] border border-[#222530] hover:border-[#3A3F52] px-2.5 py-1.5 rounded text-[11px] font-mono text-[#F5F5F7] flex items-center gap-1.5 backdrop-blur-sm transition-colors cursor-pointer"
        >
          {isSimulated ? (
            <>
              <Camera className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="hidden sm:inline">Live Camera</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-[#E2E8F0]" />
              <span className="hidden sm:inline">Simulator</span>
            </>
          )}
        </button>
      </div>

      {/* Camera Access Error Prompt Banner */}
      {cameraError && !isSimulated && (
        <div className="absolute top-16 left-4 z-20 bg-[#131418]/95 border border-[#EF4444]/40 p-3 rounded max-w-sm text-xs font-mono space-y-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[#EF4444] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>CAMERA ACCESS NOTICE</span>
          </div>
          <p className="text-[#7E8294] leading-normal text-[11px]">
            {cameraError} Switched to studio mannequin simulation.
          </p>
          <button
            onClick={startWebcam}
            className="text-[10px] text-[#F5F5F7] bg-[#1A1C23] hover:bg-[#222530] border border-[#222530] px-2 py-1 rounded transition-colors cursor-pointer"
          >
            Retry Camera
          </button>
        </div>
      )}
    </div>
  );
};
