import React, { useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Shield,
  SwitchCamera,
  Image as ImageIcon,
  Camera as CameraIcon
} from 'lucide-react';
import {
  BodyDimensions,
  GarmentItem,
  FitEngineMode,
  SilhouettePreference,
  SnapshotData,
  ScanPhase
} from './lib/types';
import { GARMENT_PRESETS } from './lib/garmentPresets';
import { CameraViewport } from './components/CameraViewport';
import { DimensionOverlay } from './components/DimensionOverlay';
import { ControlToolbar } from './components/ControlToolbar';
import { GarmentDrawer } from './components/GarmentDrawer';
import { RecommendationDrawer } from './components/RecommendationDrawer';
import { LegalModal } from './components/LegalModal';
import { SnapshotModal } from './components/SnapshotModal';
import { GarmentScannerModal } from './components/GarmentScannerModal';

export function App() {
  // Garment state
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem>(GARMENT_PRESETS[0]);
  const [customGarmentCanvas, setCustomGarmentCanvas] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>(GARMENT_PRESETS[0].defaultSize);

  // Fit & Render controls
  const [opacity, setOpacity] = useState<number>(0.92);
  const [wireframeOnly, setWireframeOnly] = useState<boolean>(false);
  const [fitEngine, setFitEngine] = useState<FitEngineMode>('mesh');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [silhouettePreference, setSilhouettePreference] = useState<SilhouettePreference>('regular');

  // Mobile camera state: 'user' (front selfie) or 'environment' (rear lens)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Simulation & Stream state
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  // 2-Phase Body Scan Workflow
  const [scanPhase, setScanPhase] = useState<ScanPhase>('scanning');

  // User Portrait Photo Try-On State
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const userPhotoInputRef = useRef<HTMLInputElement>(null);

  // Real-time body dimensions
  const [dimensions, setDimensions] = useState<BodyDimensions>({
    shoulderWidthCm: 46.2,
    torsoLengthCm: 62.5,
    chestCircumferenceCm: 102.4,
    shoulderWidthIn: 18.2,
    torsoLengthIn: 24.6,
    chestCircumferenceIn: 40.3,
    distanceEstimateM: 1.8,
    alignmentScore: 94,
    isAligned: true,
    confidence: 0.98,
    scanPhase: 'scanning',
    stabilityProgress: 0
  });

  // Modals and Drawers
  const [isWardrobeOpen, setIsWardrobeOpen] = useState<boolean>(false);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState<boolean>(false);
  const [isLegalOpen, setIsLegalOpen] = useState<boolean>(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);

  // Snapshot capture state
  const [snapshotTrigger, setSnapshotTrigger] = useState<number>(0);
  const [currentSnapshot, setCurrentSnapshot] = useState<SnapshotData | null>(null);

  // Callbacks
  const handleDimensionsUpdate = useCallback((dims: BodyDimensions) => {
    setDimensions(dims);
  }, []);

  const handleSelectGarment = (garment: GarmentItem) => {
    setSelectedGarment(garment);
    setCustomGarmentCanvas(null);
    setSelectedSize(garment.defaultSize);
  };

  const handleCustomGarmentLoaded = (
    canvas: HTMLCanvasElement | HTMLImageElement,
    garment: GarmentItem
  ) => {
    setSelectedGarment(garment);
    setCustomGarmentCanvas(canvas);
    setSelectedSize(garment.defaultSize);
  };

  const handleGarmentDigitized = (
    canvas: HTMLCanvasElement,
    garment: GarmentItem
  ) => {
    setSelectedGarment(garment);
    setCustomGarmentCanvas(canvas);
    setSelectedSize(garment.defaultSize);
  };

  const handleTakeSnapshot = () => {
    setSnapshotTrigger(Date.now());
  };

  const handleSnapshotCaptured = useCallback((data: SnapshotData) => {
    setCurrentSnapshot(data);
  }, []);

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Rescan Trigger
  const handleRescan = useCallback(() => {
    setScanPhase('scanning');
  }, []);

  // Upload user portrait for static try-on
  const handleUserPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUserPhotoUrl(dataUrl);
      setScanPhase('locked');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative w-screen h-screen bg-[#0A0A0C] text-[#F5F5F7] flex flex-col select-none overflow-hidden font-sans">
      {/* Top Editorial App Bar */}
      <header className="h-12 border-b border-[#222530] bg-[#0A0A0C]/90 px-3 sm:px-6 flex items-center justify-between z-20 shrink-0 backdrop-blur-sm">
        {/* Brandmark */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-bold tracking-widest text-[#F5F5F7]">
              E-SUOT
            </span>
            <span className="text-[10px] font-mono text-[#7E8294] tracking-wider hidden sm:inline">
              // STUDIO FITTING ROOM
            </span>
          </div>
          <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-[#222530] text-[10px] font-mono text-[#7E8294]">
            <span className="text-[#10B981] font-semibold">CLIENT-SIDE PRIVACY</span>
            <span>•</span>
            <span>WASM ACCELERATED</span>
          </div>
        </div>

        {/* Current Garment Pill */}
        <div
          onClick={() => setIsWardrobeOpen(true)}
          className="bg-[#131418] hover:bg-[#1A1C23] border border-[#222530] hover:border-[#3A3F52] px-3 py-1 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: selectedGarment.hex }}
          />
          <span className="font-medium text-[#F5F5F7] max-w-[110px] sm:max-w-[200px] truncate">
            {selectedGarment.name}
          </span>
          <span className="font-mono text-[#7E8294] text-[11px]">
            [{selectedSize}]
          </span>
        </div>

        {/* Right Header Utilities */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Snap Clothes Trigger */}
          <button
            onClick={() => setIsScannerModalOpen(true)}
            title="Snap Flat-Lay or Worn Clothes with Camera"
            className="flex items-center gap-1 text-xs font-mono text-[#F5F5F7] bg-[#131418] hover:bg-[#1A1C23] border border-[#222530] hover:border-[#10B981] px-2 sm:px-2.5 py-1 rounded transition-colors cursor-pointer"
          >
            <CameraIcon className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="hidden md:inline">Snap Clothes</span>
          </button>

          {/* Photo Try-On Upload Trigger */}
          <button
            onClick={() => userPhotoInputRef.current?.click()}
            title="Try On Garment on Your Uploaded Photo"
            className="flex items-center gap-1 text-xs font-mono text-[#F5F5F7] bg-[#131418] hover:bg-[#1A1C23] border border-[#222530] px-2 sm:px-2.5 py-1 rounded transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="hidden md:inline">Photo Try-On</span>
          </button>
          <input
            ref={userPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleUserPhotoChange}
            className="hidden"
          />

          {/* Quick Camera Flip on Mobile Header */}
          {!userPhotoUrl && (
            <button
              onClick={handleToggleFacingMode}
              title={`Switch to ${facingMode === 'user' ? 'Rear' : 'Front'} Camera`}
              className="flex items-center gap-1 text-xs font-mono text-[#7E8294] hover:text-[#F5F5F7] bg-[#131418] hover:bg-[#1A1C23] border border-[#222530] px-2 py-1 rounded transition-colors cursor-pointer"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-[#E2E8F0]" />
              <span className="hidden md:inline">{facingMode === 'user' ? 'Front' : 'Rear'}</span>
            </button>
          )}

          {/* Fit Advisor Drawer */}
          <button
            onClick={() => setIsRecommendationOpen(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-[#F5F5F7] bg-[#131418] hover:bg-[#1A1C23] border border-[#222530] px-2.5 py-1 rounded transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Advisor</span>
          </button>

          {/* Legal / Privacy modal */}
          <button
            onClick={() => setIsLegalOpen(true)}
            title="Legal & Biometric Privacy Architecture"
            className="text-[#7E8294] hover:text-[#F5F5F7] p-1.5 rounded hover:bg-[#1A1C23] transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="relative flex-1 w-full h-[calc(100vh-48px)] overflow-hidden">
        {/* Live Camera / Photo Mirror Viewport */}
        <CameraViewport
          currentGarment={selectedGarment}
          customGarmentCanvas={customGarmentCanvas}
          selectedSize={selectedSize}
          opacity={opacity}
          wireframeOnly={wireframeOnly}
          fitEngine={fitEngine}
          showLandmarks={showLandmarks}
          onDimensionsUpdate={handleDimensionsUpdate}
          isSimulated={isSimulated}
          onToggleSimulator={setIsSimulated}
          snapshotTrigger={snapshotTrigger}
          onSnapshotCaptured={handleSnapshotCaptured}
          facingMode={facingMode}
          onToggleFacingMode={handleToggleFacingMode}
          userPhotoUrl={userPhotoUrl}
          onClearUserPhoto={() => setUserPhotoUrl(null)}
          scanPhase={scanPhase}
          onScanPhaseChange={setScanPhase}
          onRescan={handleRescan}
        />

        {/* Real-time Dimension HUD Overlay */}
        <DimensionOverlay
          dimensions={dimensions}
          isSimulated={isSimulated}
          unit={unit}
          onToggleUnit={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
          onRescan={handleRescan}
        />

        {/* Floating Bottom Control Strip */}
        <ControlToolbar
          opacity={opacity}
          onOpacityChange={setOpacity}
          selectedSize={selectedSize}
          onSizeChange={setSelectedSize}
          availableSizes={selectedGarment.availableSizes}
          wireframeOnly={wireframeOnly}
          onToggleWireframe={() => setWireframeOnly(!wireframeOnly)}
          fitEngine={fitEngine}
          onToggleFitEngine={() => setFitEngine(fitEngine === 'mesh' ? 'quick' : 'mesh')}
          showLandmarks={showLandmarks}
          onToggleLandmarks={() => setShowLandmarks(!showLandmarks)}
          onTakeSnapshot={handleTakeSnapshot}
          onOpenWardrobe={() => setIsWardrobeOpen(true)}
          onOpenRecommendations={() => setIsRecommendationOpen(true)}
          onOpenLegal={() => setIsLegalOpen(true)}
        />
      </main>

      {/* Slide-out Garment Wardrobe Drawer */}
      <GarmentDrawer
        isOpen={isWardrobeOpen}
        onClose={() => setIsWardrobeOpen(false)}
        selectedGarment={selectedGarment}
        onSelectGarment={handleSelectGarment}
        onCustomGarmentLoaded={handleCustomGarmentLoaded}
        onOpenScannerModal={() => {
          setIsWardrobeOpen(false);
          setIsScannerModalOpen(true);
        }}
      />

      {/* Garment Scanner / Digitizer Modal */}
      <GarmentScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onGarmentDigitized={handleGarmentDigitized}
      />

      {/* Slide-out Fit & Sizing Recommendation Drawer */}
      <RecommendationDrawer
        isOpen={isRecommendationOpen}
        onClose={() => setIsRecommendationOpen(false)}
        dimensions={dimensions}
        currentGarment={selectedGarment}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        silhouettePreference={silhouettePreference}
        onChangeSilhouette={setSilhouettePreference}
      />

      {/* Legal, Privacy & Compliance Modal */}
      <LegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
      />

      {/* Lookbook Snapshot Modal */}
      <SnapshotModal
        snapshot={currentSnapshot}
        onClose={() => setCurrentSnapshot(null)}
      />
    </div>
  );
}

export default App;
