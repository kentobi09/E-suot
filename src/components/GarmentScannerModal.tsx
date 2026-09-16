import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, RotateCcw, Check, Sliders, SwitchCamera } from 'lucide-react';
import { GarmentItem } from '../lib/types';
import { garmentFitter } from '../lib/garmentFitter';

interface GarmentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGarmentDigitized: (canvas: HTMLCanvasElement, garment: GarmentItem) => void;
}

export const GarmentScannerModal: React.FC<GarmentScannerModalProps> = ({
  isOpen,
  onClose,
  onGarmentDigitized
}) => {
  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Captured / loaded image
  const [capturedImage, setCapturedImage] = useState<HTMLImageElement | null>(null);
  const [cutoutCanvas, setCutoutCanvas] = useState<HTMLCanvasElement | null>(null);

  // Parameters
  const [bgThreshold, setBgThreshold] = useState<number>(38);
  const [featherEdges, setFeatherEdges] = useState<boolean>(true);
  const [garmentName, setGarmentName] = useState<string>('My Snapped Garment');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
        };
      }
    } catch (err: any) {
      console.warn('Garment scanner camera error:', err);
      setCameraError('Camera access unavailable. You can upload a photo of your clothes instead.');
      setCameraActive(false);
    }
  }, [facingMode]);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (isOpen && step === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, step, startCamera, stopCamera]);

  // Capture current video frame
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    const img = new Image();
    img.onload = () => {
      setCapturedImage(img);
      processCutout(img, bgThreshold, featherEdges);
      setStep('review');
    };
    img.src = dataUrl;
  };

  // Upload Photo instead of snapping
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setCapturedImage(img);
        setGarmentName(file.name.replace(/\.[^/.]+$/, ''));
        processCutout(img, bgThreshold, featherEdges);
        setStep('review');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Run client-side background cutout
  const processCutout = (img: HTMLImageElement, threshold: number, feather: boolean) => {
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const canvas = garmentFitter.processBackgroundRemoval(img, threshold, feather);
        setCutoutCanvas(canvas);
      } catch (err) {
        console.error('Failed to process cutout:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 20);
  };

  const handleUpdateThreshold = (val: number) => {
    setBgThreshold(val);
    if (capturedImage) {
      processCutout(capturedImage, val, featherEdges);
    }
  };

  const handleToggleFeather = () => {
    const next = !featherEdges;
    setFeatherEdges(next);
    if (capturedImage) {
      processCutout(capturedImage, bgThreshold, next);
    }
  };

  // Save to Wardrobe and Try On
  const handleSaveAndTryOn = () => {
    if (!cutoutCanvas || !capturedImage) return;

    const customGarment: GarmentItem = {
      id: `snapped-${Date.now()}`,
      name: garmentName.trim() || 'Custom Snapped Piece',
      category: 'Digitized Wardrobe',
      editorialCode: `DIG-${Math.floor(1000 + Math.random() * 9000)}`,
      brand: 'USER ARCHIVE',
      colorName: 'Original Tone',
      hex: '#2B2E3A',
      description: 'Digitized via E-suot Camera Scanner with client-side edge isolation.',
      fabricSpec: 'Live Texture Capture',
      silhouette: 'Regular',
      imageUrl: cutoutCanvas.toDataURL(),
      aspectRatio: (capturedImage.naturalWidth || 500) / (capturedImage.naturalHeight || 600),
      anchorPointRatio: { x: 0.5, y: 0.14 },
      scaleFactor: 1.08,
      offsetYFactor: 0.02,
      availableSizes: ['S', 'M', 'L', 'XL'],
      defaultSize: 'M',
      sizeChart: {
        S: { chestCm: 100, shoulderCm: 45.0, lengthCm: 70 },
        M: { chestCm: 106, shoulderCm: 47.0, lengthCm: 72 },
        L: { chestCm: 112, shoulderCm: 49.0, lengthCm: 74 },
        XL: { chestCm: 118, shoulderCm: 51.0, lengthCm: 76 }
      }
    };

    onGarmentDigitized(cutoutCanvas, customGarment);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0C]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#131418] border border-[#222530] w-full max-w-xl rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-[#222530] px-4 flex items-center justify-between bg-[#0A0A0C]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#F5F5F7] tracking-wider uppercase">
              // GARMENT DIGITIZER
            </span>
            <span className="text-[10px] font-mono text-[#7E8294]">
              {step === 'capture' ? 'STEP 1: CAPTURE' : 'STEP 2: ISOLATE & SAVE'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#7E8294] hover:text-[#F5F5F7] p-1.5 rounded hover:bg-[#1A1C23] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {step === 'capture' ? (
            <div className="space-y-4">
              {/* Instructions Micro-copy */}
              <div className="text-[11px] font-mono text-[#7E8294] bg-[#0A0A0C] border border-[#222530] p-2.5 rounded">
                <span className="text-[#10B981] font-semibold">TIPS: </span>
                Lay your shirt flat against a plain contrast background (e.g. bed, floor, white sheet), or take a photo while wearing it.
              </div>

              {/* Camera Viewfinder */}
              <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-black rounded border border-[#222530] overflow-hidden flex items-center justify-center">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Framing Guidelines Overlay */}
                    <div className="absolute inset-4 border border-dashed border-[#E2E8F0]/40 pointer-events-none rounded flex flex-col justify-between p-3">
                      <div className="flex justify-between text-[10px] font-mono text-[#E2E8F0]/80">
                        <span>[ COLLAR / TOP ]</span>
                        <span>[ REAR LENS ]</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#E2E8F0]/80">
                        <span>[ BOTTOM HEM ]</span>
                        <span>[ ALIGN FLAT ]</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <p className="text-xs font-mono text-[#7E8294]">
                      {cameraError || 'Initializing camera stream...'}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 bg-[#E2E8F0] text-[#0A0A0C] px-3.5 py-2 rounded text-xs font-semibold hover:bg-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo of Clothes
                    </button>
                  </div>
                )}
              </div>

              {/* Capture & Lens Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#7E8294] hover:text-[#F5F5F7] bg-[#0A0A0C] border border-[#222530] rounded cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {cameraActive && (
                  <button
                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#7E8294] hover:text-[#F5F5F7] bg-[#0A0A0C] border border-[#222530] rounded cursor-pointer transition-colors"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Flip Lens</span>
                  </button>
                )}

                {cameraActive && (
                  <button
                    onClick={handleCaptureFrame}
                    className="flex items-center gap-2 bg-[#E2E8F0] hover:bg-white text-[#0A0A0C] px-4 py-2 rounded text-xs font-semibold cursor-pointer shadow-lg transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Garment</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Review & Refinement Step */
            <div className="space-y-4">
              {/* Checkerboard Preview Area */}
              <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-[#0A0A0C] border border-[#222530] rounded overflow-hidden flex items-center justify-center">
                {/* Checkerboard texture to highlight transparent cutout */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #222530 25%, transparent 25%), linear-gradient(-45deg, #222530 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222530 75%), linear-gradient(-45deg, transparent 75%, #222530 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                />

                {cutoutCanvas ? (
                  <img
                    src={cutoutCanvas.toDataURL()}
                    alt="Isolated Garment"
                    className="relative max-w-full max-h-full object-contain z-10"
                  />
                ) : (
                  <div className="relative z-10 text-xs font-mono text-[#7E8294]">
                    Extracting garment silhouette...
                  </div>
                )}

                {isProcessing && (
                  <div className="absolute inset-0 bg-[#0A0A0C]/70 flex items-center justify-center z-20">
                    <span className="text-xs font-mono text-[#E2E8F0] animate-pulse">
                      Isolating Garment Boundaries...
                    </span>
                  </div>
                )}
              </div>

              {/* Garment Details & Sliders */}
              <div className="space-y-3 bg-[#0A0A0C] p-3.5 rounded border border-[#222530]">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-[#7E8294] uppercase tracking-wider block">
                    GARMENT NAME / LABEL
                  </label>
                  <input
                    type="text"
                    value={garmentName}
                    onChange={(e) => setGarmentName(e.target.value)}
                    className="w-full bg-[#131418] border border-[#222530] focus:border-[#E2E8F0] text-xs text-[#F5F5F7] px-3 py-1.5 rounded font-mono outline-none"
                  />
                </div>

                {/* Tolerance & Edge Feathering Controls */}
                <div className="space-y-2 pt-1 border-t border-[#222530]">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#7E8294] flex items-center gap-1.5">
                      <Sliders className="w-3 h-3" /> Background Removal Tolerance:
                    </span>
                    <span className="text-[#F5F5F7] font-semibold">{bgThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="80"
                    value={bgThreshold}
                    onChange={(e) => handleUpdateThreshold(Number(e.target.value))}
                    className="w-full accent-[#E2E8F0] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-mono text-[#7E8294]">Soft Edge Feathering</span>
                  <button
                    onClick={handleToggleFeather}
                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                      featherEdges
                        ? 'bg-[#E2E8F0] text-[#0A0A0C] font-semibold'
                        : 'bg-[#131418] text-[#7E8294] border border-[#222530]'
                    }`}
                  >
                    {featherEdges ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setStep('capture')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#7E8294] hover:text-[#F5F5F7] bg-[#0A0A0C] border border-[#222530] rounded cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>

                <button
                  onClick={handleSaveAndTryOn}
                  disabled={!cutoutCanvas || isProcessing}
                  className="flex items-center gap-2 bg-[#E2E8F0] hover:bg-white disabled:opacity-50 text-[#0A0A0C] px-4 py-2 rounded text-xs font-semibold cursor-pointer shadow-lg transition-transform active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Add to Wardrobe & Try On</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
