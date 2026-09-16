import React from 'react';
import { BodyDimensions } from '../lib/types';
import { RotateCcw, SwitchCamera, Camera, Monitor, Image as ImageIcon } from 'lucide-react';

interface DimensionOverlayProps {
  dimensions: BodyDimensions;
  isSimulated: boolean;
  unit: 'metric' | 'imperial';
  onToggleUnit: () => void;
  onRescan?: () => void;
  cameraActive?: boolean;
  facingMode?: 'user' | 'environment';
  onToggleFacingMode?: () => void;
  fps?: number;
  userPhotoUrl?: string | null;
  onClearUserPhoto?: () => void;
  onToggleSimulator?: (sim: boolean) => void;
}

export const DimensionOverlay: React.FC<DimensionOverlayProps> = ({
  dimensions,
  isSimulated,
  unit,
  onToggleUnit,
  onRescan,
  cameraActive = false,
  facingMode = 'user',
  onToggleFacingMode,
  fps = 30,
  userPhotoUrl,
  onClearUserPhoto,
  onToggleSimulator
}) => {
  const isMetric = unit === 'metric';
  const isScanning = dimensions.scanPhase === 'scanning';

  const shoulderVal = isMetric
    ? `${dimensions.shoulderWidthCm.toFixed(1)}cm`
    : `${dimensions.shoulderWidthIn.toFixed(1)}in`;

  const torsoVal = isMetric
    ? `${dimensions.torsoLengthCm.toFixed(1)}cm`
    : `${dimensions.torsoLengthIn.toFixed(1)}in`;

  const chestVal = isMetric
    ? `${dimensions.chestCircumferenceCm.toFixed(1)}cm`
    : `${dimensions.chestCircumferenceIn.toFixed(1)}in`;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none z-10 overflow-hidden">
      {/* 1. Unified Top HUD Bar (Single Row, Never Overlapping) */}
      <div className="w-full flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left: Feed info */}
          <div className="bg-[#131418]/90 border border-[#222530] px-2 sm:px-2.5 py-1 rounded flex items-center gap-1.5 backdrop-blur-sm text-[10px] sm:text-[11px] font-mono shrink-0 shadow-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                userPhotoUrl
                  ? 'bg-[#3B82F6]'
                  : cameraActive
                  ? 'bg-[#10B981]'
                  : isSimulated
                  ? 'bg-[#E2E8F0]'
                  : 'bg-[#EF4444]'
              }`}
            />
            <span className="text-[#F5F5F7] font-semibold tracking-wider uppercase">
              {userPhotoUrl
                ? 'PHOTO'
                : cameraActive
                ? (facingMode === 'user' ? 'FRONT' : 'REAR')
                : isSimulated
                ? 'SIM'
                : 'OFF'}
            </span>
            <span className="text-[#3A3F52]">|</span>
            <span className="text-[#7E8294] tabular-nums">{fps}FPS</span>
          </div>

          {/* Center: Scan Status & Rescan Action */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isScanning ? (
              <div className="bg-[#131418]/90 border border-[#222530] px-2.5 sm:px-3 py-1 rounded text-[10px] sm:text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-sm shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[#F5F5F7] font-medium">
                  {dimensions.isAligned
                    ? `SCAN: ${dimensions.stabilityProgress || 0}%`
                    : 'ALIGN BODY'}
                </span>
              </div>
            ) : (
              <div className="bg-[#131418]/90 border border-[#222530] px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-sm shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className="text-[#10B981] font-semibold tracking-wide">LOCKED</span>
                {onRescan && !userPhotoUrl && (
                  <button
                    onClick={onRescan}
                    className="text-[10px] text-[#7E8294] hover:text-[#F5F5F7] ml-0.5 pl-1.5 border-l border-[#222530] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-[#10B981]" />
                    <span className="hidden xs:inline">Rescan</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick lens flip / photo exit / sim toggle */}
          <div className="flex items-center gap-1 shrink-0">
            {userPhotoUrl && onClearUserPhoto && (
              <button
                onClick={onClearUserPhoto}
                className="bg-[#131418]/90 hover:bg-[#1A1C23] border border-[#3B82F6]/50 px-2 py-1 rounded text-[10px] font-mono text-[#F5F5F7] flex items-center gap-1 backdrop-blur-sm cursor-pointer transition-colors"
              >
                <Camera className="w-3 h-3 text-[#3B82F6]" />
                <span className="hidden sm:inline">Live Cam</span>
              </button>
            )}

            {!userPhotoUrl && cameraActive && onToggleFacingMode && (
              <button
                onClick={onToggleFacingMode}
                title="Switch Camera Lens"
                className="bg-[#131418]/90 hover:bg-[#1A1C23] border border-[#222530] p-1 sm:px-2 sm:py-1 rounded text-[10px] font-mono text-[#F5F5F7] flex items-center gap-1 backdrop-blur-sm cursor-pointer transition-colors"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-[#E2E8F0]" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}

            {!userPhotoUrl && onToggleSimulator && (
              <button
                onClick={() => onToggleSimulator(!isSimulated)}
                title={isSimulated ? "Switch to live camera" : "Switch to studio simulator"}
                className="bg-[#131418]/90 hover:bg-[#1A1C23] border border-[#222530] p-1 sm:px-2 sm:py-1 rounded text-[10px] font-mono text-[#7E8294] hover:text-[#F5F5F7] flex items-center gap-1 backdrop-blur-sm cursor-pointer transition-colors"
              >
                {isSimulated ? (
                  <Camera className="w-3.5 h-3.5 text-[#10B981]" />
                ) : (
                  <Monitor className="w-3.5 h-3.5 text-[#E2E8F0]" />
                )}
                <span className="hidden md:inline">{isSimulated ? "Live" : "Sim"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Phase 1 Linear Scan Progress Indicator (Thin sleek hairline) */}
        {isScanning && (
          <div className="w-56 sm:w-72 h-1 bg-[#222530]/80 rounded-full overflow-hidden backdrop-blur-sm border border-[#3A3F52]/40 shadow-sm">
            <div
              className="h-full bg-[#10B981] transition-all duration-100 ease-out"
              style={{ width: `${dimensions.stabilityProgress || 0}%` }}
            />
          </div>
        )}
      </div>

      {/* 2. Center Hairline Frame Reticles */}
      <div className="relative w-full h-full my-auto pointer-events-none">
        {/* Frame Corners */}
        <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t border-l border-[#222530]" />
        <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t border-r border-[#222530]" />
        <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b border-l border-[#222530]" />
        <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b border-r border-[#222530]" />

        {/* Studio Mannequin Hairline Silhouette (Only while scanning) */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <svg
              className="w-56 h-72 sm:w-72 sm:h-96 stroke-[#E2E8F0]"
              fill="none"
              strokeWidth="0.8"
              strokeDasharray="3 3"
              viewBox="0 0 200 300"
            >
              <ellipse cx="100" cy="50" rx="22" ry="28" />
              <line x1="100" y1="78" x2="100" y2="100" />
              <line x1="45" y1="105" x2="155" y2="105" />
              <path d="M 45 105 L 60 230 L 140 230 L 155 105" />
            </svg>
          </div>
        )}
      </div>

      {/* 3. Floating Telemetry Strip (Safely elevated ABOVE the bottom ControlToolbar) */}
      <div className="w-full mb-16 sm:mb-14 flex justify-center pointer-events-auto">
        <div className="bg-[#131418]/90 border border-[#222530] rounded-md px-2.5 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-3 backdrop-blur-md shadow-xl max-w-full overflow-x-auto text-[10px] sm:text-[11px] font-mono">
          {/* Shoulder */}
          <div className="flex items-center gap-1 tabular-nums whitespace-nowrap">
            <span className="text-[#7E8294]">SH:</span>
            <span className="text-[#F5F5F7] font-medium">{shoulderVal}</span>
          </div>

          <span className="text-[#222530]">|</span>

          {/* Torso */}
          <div className="flex items-center gap-1 tabular-nums whitespace-nowrap">
            <span className="text-[#7E8294]">TOR:</span>
            <span className="text-[#F5F5F7] font-medium">{torsoVal}</span>
          </div>

          <span className="text-[#222530]">|</span>

          {/* Chest */}
          <div className="flex items-center gap-1 tabular-nums whitespace-nowrap">
            <span className="text-[#7E8294]">CHEST:</span>
            <span className="text-[#F5F5F7] font-medium">{chestVal}</span>
          </div>

          <span className="text-[#222530]">|</span>

          {/* Distance */}
          <div className="flex items-center gap-1 tabular-nums whitespace-nowrap">
            <span className="text-[#7E8294]">DIST:</span>
            <span className="text-[#F5F5F7] font-medium">{dimensions.distanceEstimateM.toFixed(1)}m</span>
          </div>

          <span className="text-[#222530]">|</span>

          {/* Unit Toggle */}
          <button
            onClick={onToggleUnit}
            title="Toggle Metric (cm) / Imperial (in)"
            className="text-[9px] font-mono text-[#7E8294] hover:text-[#F5F5F7] font-bold uppercase transition-colors cursor-pointer shrink-0"
          >
            {unit === 'metric' ? 'CM' : 'IN'}
          </button>
        </div>
      </div>
    </div>
  );
};
