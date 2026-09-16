import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertTriangle, Monitor, SwitchCamera, RotateCcw, Check, Image as ImageIcon } from 'lucide-react';
import { BodyDimensions, GarmentItem, PoseKeypoints, FitEngineMode, SnapshotData, ScanPhase, LandmarkPoint } from '../lib/types';
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
  userPhotoUrl?: string | null;
  onClearUserPhoto?: () => void;
  scanPhase: ScanPhase;
  onScanPhaseChange: (phase: ScanPhase) => void;
  onRescan: () => void;
  onFpsUpdate?: (fps: number) => void;
  onCameraStatusChange?: (active: boolean) => void;
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
  onToggleFacingMode,
  userPhotoUrl,
  onClearUserPhoto,
  scanPhase,
  onScanPhaseChange,
  onRescan,
  onFpsUpdate,
  onCameraStatusChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(30);
  const [activeImageSource, setActiveImageSource] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);

  // User uploaded photo element
  const userPhotoImgRef = useRef<HTMLImageElement | null>(null);

  // Performance & Stability tracking
  const frameCountRef = useRef<number>(0);
  const lastFpsCheckRef = useRef<number>(performance.now());
  const lastKeypointsRef = useRef<PoseKeypoints | null>(null);
  const lastDimensionsRef = useRef<BodyDimensions | null>(null);
  const stableFramesRef = useRef<number>(0);
  const lastShoulderWidthRef = useRef<number>(0);

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

  // Handle User Photo Ingestion for Static Try-On
  useEffect(() => {
    if (!userPhotoUrl) {
      userPhotoImgRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      userPhotoImgRef.current = img;
      stableFramesRef.current = 50;
      onScanPhaseChange('locked');
    };
    img.src = userPhotoUrl;
  }, [userPhotoUrl, onScanPhaseChange]);

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
          onCameraStatusChange?.(true);
          onToggleSimulator(false);
        };
      }
    } catch (err: any) {
      console.warn('Webcam stream unavailable or access denied:', err);
      setCameraError(err.message || 'Camera permission denied or camera device in use.');
      setCameraActive(false);
      onCameraStatusChange?.(false);
      onToggleSimulator(true);
    }
  }, [facingMode, onToggleSimulator, onCameraStatusChange]);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      onCameraStatusChange?.(false);
    }
  }, [onCameraStatusChange]);

  // Handle stream lifecycle when mode or lens changes
  useEffect(() => {
    if (!isSimulated && !userPhotoUrl) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isSimulated, facingMode, userPhotoUrl, startWebcam, stopWebcam]);

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
        onFpsUpdate?.(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsCheckRef.current = time;
      }

      let currentKeypoints: PoseKeypoints | null = null;
      let currentDimensions: BodyDimensions | null = null;

      // ==========================================
      // 1. Draw Feed & Adapt Exact Aspect Ratio
      // ==========================================
      if (userPhotoUrl && userPhotoImgRef.current && userPhotoImgRef.current.complete) {
        const photo = userPhotoImgRef.current;
        const pw = photo.naturalWidth || 720;
        const ph = photo.naturalHeight || 1280;

        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }

        ctx.drawImage(photo, 0, 0, pw, ph);

        // Detect pose on static photo
        const det = poseEngine.detect(photo, time);
        if (det.keypoints) {
          currentKeypoints = det.keypoints;
          currentDimensions = {
            ...det.dimensions,
            scanPhase: 'locked',
            stabilityProgress: 100
          };
          if (scanPhase !== 'locked') {
            onScanPhaseChange('locked');
          }
        }
      } else if (!isSimulated && cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const vw = video.videoWidth || 720;
        const vh = video.videoHeight || 1280;

        // Adapt canvas to match native optical camera aspect ratio perfectly
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        const isSelfie = facingMode === 'user';
        if (isSelfie) {
          ctx.save();
          ctx.translate(vw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, vw, vh);
          ctx.restore();
        } else {
          ctx.drawImage(video, 0, 0, vw, vh);
        }

        // Detect real pose
        const det = poseEngine.detect(video, time);
        if (det.keypoints) {
          if (isSelfie) {
            const flip = (pt?: LandmarkPoint): LandmarkPoint | undefined => {
              if (!pt) return undefined;
              return { ...pt, x: 1 - pt.x };
            };

            const mirroredKeypoints: PoseKeypoints = {
              ...det.keypoints,
              nose: flip(det.keypoints.nose),
              leftEye: flip(det.keypoints.leftEye),
              rightEye: flip(det.keypoints.rightEye),
              leftEar: flip(det.keypoints.leftEar),
              rightEar: flip(det.keypoints.rightEar),
              leftShoulder: flip(det.keypoints.leftShoulder)!,
              rightShoulder: flip(det.keypoints.rightShoulder)!,
              leftElbow: flip(det.keypoints.leftElbow),
              rightElbow: flip(det.keypoints.rightElbow),
              leftWrist: flip(det.keypoints.leftWrist),
              rightWrist: flip(det.keypoints.rightWrist),
              leftHip: flip(det.keypoints.leftHip)!,
              rightHip: flip(det.keypoints.rightHip)!,
              neckBase: flip(det.keypoints.neckBase)!,
              midHip: flip(det.keypoints.midHip)!,
              chestMid: flip(det.keypoints.chestMid)!,
              shoulderSlopeRad: -det.keypoints.shoulderSlopeRad,
              bodyRotationY: -det.keypoints.bodyRotationY
            };
            currentKeypoints = mirroredKeypoints;
          } else {
            currentKeypoints = det.keypoints;
          }

          // 2-Phase Stability Computation
          if (scanPhase === 'scanning') {
            const shoulderDelta = Math.abs(currentKeypoints.shoulderWidthNorm - lastShoulderWidthRef.current);
            lastShoulderWidthRef.current = currentKeypoints.shoulderWidthNorm;

            if (det.dimensions.isAligned && shoulderDelta < 0.035) {
              // Frame is steady and aligned: increase accumulator
              stableFramesRef.current = Math.min(45, stableFramesRef.current + 1);
            } else {
              // Drift or unaligned: decay accumulator
              stableFramesRef.current = Math.max(0, stableFramesRef.current - 1);
            }

            const progress = Math.min(100, Math.round((stableFramesRef.current / 40) * 100));

            currentDimensions = {
              ...det.dimensions,
              scanPhase: 'scanning',
              stabilityProgress: progress
            };

            if (progress >= 100) {
              onScanPhaseChange('locked');
            }
          } else {
            currentDimensions = {
              ...det.dimensions,
              scanPhase: 'locked',
              stabilityProgress: 100
            };
          }
        }
      } else {
        // Studio Simulator Mode (Natural dynamic aspect ratio)
        const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
        const simW = isPortrait ? 720 : 1280;
        const simH = isPortrait ? 1280 : 720;

        if (canvas.width !== simW || canvas.height !== simH) {
          canvas.width = simW;
          canvas.height = simH;
        }

        ctx.fillStyle = '#0A0A0C';
        ctx.fillRect(0, 0, simW, simH);

        // Subtle studio grid rules
        ctx.strokeStyle = '#16171E';
        ctx.lineWidth = 1;
        const gridSize = 48;
        for (let x = 0; x < simW; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, simH);
          ctx.stroke();
        }
        for (let y = 0; y < simH; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(simW, y);
          ctx.stroke();
        }

        // Draw synthetic mannequin silhouette
        const synth = poseEngine.getSyntheticPose(time / 1000);
        currentKeypoints = synth.keypoints;
        currentDimensions = {
          ...synth.dimensions,
          scanPhase: 'locked',
          stabilityProgress: 100
        };

        // Draw soft mannequin body silhouette
        ctx.save();
        ctx.fillStyle = '#181A22';
        ctx.strokeStyle = '#272B36';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.ellipse(currentKeypoints.neckBase.x * simW, currentKeypoints.neckBase.y * simH - 65, 30, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(currentKeypoints.neckBase.x * simW - 12, currentKeypoints.neckBase.y * simH - 35, 24, 35);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        const ls = { x: currentKeypoints.leftShoulder.x * simW, y: currentKeypoints.leftShoulder.y * simH };
        const rs = { x: currentKeypoints.rightShoulder.x * simW, y: currentKeypoints.rightShoulder.y * simH };
        const lh = { x: currentKeypoints.leftHip.x * simW, y: currentKeypoints.leftHip.y * simH };
        const rh = { x: currentKeypoints.rightHip.x * simW, y: currentKeypoints.rightHip.y * simH };

        ctx.moveTo(ls.x, ls.y);
        ctx.lineTo(rs.x, rs.y);
        ctx.lineTo(rh.x + 10, rh.y);
        ctx.lineTo(lh.x - 10, lh.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Update parent telemetry
      if (currentDimensions) {
        lastDimensionsRef.current = currentDimensions;
        onDimensionsUpdate(currentDimensions);
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // =========================================================
      // 2. Phase 1 vs Phase 2 Logic
      // =========================================================
      if (currentKeypoints) {
        lastKeypointsRef.current = currentKeypoints;

        if (scanPhase === 'scanning') {
          // =======================================================
          // PHASE 1: BODY SCAN IN PROGRESS (Do NOT put clothes yet!)
          // =======================================================
          ctx.save();

          // A. Laser Scan Sweep Hairline
          const torsoTop = currentKeypoints.neckBase.y * ch;
          const torsoBottom = currentKeypoints.midHip.y * ch;
          const scanRange = Math.max(80, torsoBottom - torsoTop);
          const scanY = torsoTop + ((Math.sin(time / 450) + 1) / 2) * scanRange;

          const minShX = Math.min(currentKeypoints.leftShoulder.x, currentKeypoints.rightShoulder.x);
          const maxShX = Math.max(currentKeypoints.leftShoulder.x, currentKeypoints.rightShoulder.x);
          const leftX = (minShX - 0.08) * cw;
          const rightX = (maxShX + 0.08) * cw;

          // Glowing laser sweep line
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#10B981';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(leftX, scanY);
          ctx.lineTo(rightX, scanY);
          ctx.stroke();

          // Laser sweep endpoints
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.arc(leftX, scanY, 3, 0, Math.PI * 2);
          ctx.arc(rightX, scanY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // B. High-Precision Skeletal Telemetry Lines
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 245, 247, 0.6)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          // Shoulder biacromial line
          const lsX = currentKeypoints.leftShoulder.x * cw;
          const lsY = currentKeypoints.leftShoulder.y * ch;
          const rsX = currentKeypoints.rightShoulder.x * cw;
          const rsY = currentKeypoints.rightShoulder.y * ch;

          ctx.beginPath();
          ctx.moveTo(lsX, lsY);
          ctx.lineTo(rsX, rsY);
          ctx.stroke();

          // Spine vertical line
          ctx.beginPath();
          ctx.moveTo(currentKeypoints.neckBase.x * cw, currentKeypoints.neckBase.y * ch);
          ctx.lineTo(currentKeypoints.midHip.x * cw, currentKeypoints.midHip.y * ch);
          ctx.stroke();

          // Nodes at key anatomical landmarks
          ctx.setLineDash([]);
          [
            currentKeypoints.leftShoulder,
            currentKeypoints.rightShoulder,
            currentKeypoints.neckBase,
            currentKeypoints.chestMid,
            currentKeypoints.leftHip,
            currentKeypoints.rightHip
          ].forEach((pt) => {
            ctx.fillStyle = '#10B981';
            ctx.beginPath();
            ctx.arc(pt.x * cw, pt.y * ch, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0A0A0C';
            ctx.lineWidth = 1;
            ctx.stroke();
          });

          // Shoulder Dimension Label
          const midShX = (lsX + rsX) / 2;
          const midShY = Math.min(lsY, rsY) - 14;
          ctx.fillStyle = 'rgba(19, 20, 24, 0.85)';
          ctx.fillRect(midShX - 45, midShY - 10, 90, 18);
          ctx.strokeStyle = '#222530';
          ctx.strokeRect(midShX - 45, midShY - 10, 90, 18);
          ctx.fillStyle = '#F5F5F7';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`SPAN: ${(currentKeypoints.shoulderWidthNorm * 100).toFixed(0)}%`, midShX, midShY);

          ctx.restore();
        } else {
          // =======================================================
          // PHASE 2: BODY LOCKED -> RENDER CLOTHES ON USER
          // =======================================================
          if (activeImageSource) {
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
        }
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
    userPhotoUrl,
    activeImageSource,
    currentGarment,
    selectedSize,
    opacity,
    wireframeOnly,
    fitEngine,
    showLandmarks,
    scanPhase,
    onDimensionsUpdate,
    onScanPhaseChange
  ]);

  // Handle Snapshot trigger
  useEffect(() => {
    if (snapshotTrigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastDimensionsRef.current) return;

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

      {/* Main High-Resolution Canvas (Letterboxed with natural aspect ratio) */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain max-w-full max-h-full"
      />

      {/* Camera Access Error Prompt Banner */}
      {cameraError && !isSimulated && !userPhotoUrl && (
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
