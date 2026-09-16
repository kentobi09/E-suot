import React from 'react';
import { BodyDimensions } from '../lib/types';
import { RotateCcw } from 'lucide-react';

interface DimensionOverlayProps {
  dimensions: BodyDimensions;
  isSimulated: boolean;
  unit: 'metric' | 'imperial';
  onToggleUnit: () => void;
  onRescan?: () => void;
}

export const DimensionOverlay: React.FC<DimensionOverlayProps> = ({
  dimensions,
  isSimulated,
  unit,
  onToggleUnit,
  onRescan
}) => {
  const isMetric = unit === 'metric';
  const isScanning = dimensions.scanPhase === 'scanning';

  const shoulderVal = isMetric
    ? `${dimensions.shoulderWidthCm.toFixed(1)} cm`
    : `${dimensions.shoulderWidthIn.toFixed(1)} in`;

  const torsoVal = isMetric
    ? `${dimensions.torsoLengthCm.toFixed(1)} cm`
    : `${dimensions.torsoLengthIn.toFixed(1)} in`;

  const chestVal = isMetric
    ? `${dimensions.chestCircumferenceCm.toFixed(1)} cm`
    : `${dimensions.chestCircumferenceIn.toFixed(1)} in`;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none z-10">
      {/* Top Header Micro-copy & Stability Progress Bar */}
      <div className="flex flex-col items-center gap-2">
        <div className="bg-[#131418]/90 border border-[#222530] px-3.5 py-1.5 rounded text-[11px] text-[#F5F5F7] tracking-wider uppercase flex items-center gap-2.5 backdrop-blur-sm pointer-events-auto shadow-md">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !isScanning
                ? 'bg-[#10B981]'
                : dimensions.isAligned
                ? 'bg-[#10B981] animate-pulse'
                : 'bg-[#E2E8F0] animate-pulse'
            }`}
          />
          <span className="font-mono text-[#7E8294]">
            {!isScanning ? 'GEOMETRY: LOCKED' : 'BODY SCAN: IN PROGRESS'}
          </span>
          <span className="text-[#3A3F52]">|</span>
          <span className="text-[#F5F5F7]">
            {!isScanning
              ? 'Garment Fitted & Warped'
              : dimensions.isAligned
              ? `Hold still for lock [ ${dimensions.stabilityProgress || 0}% ]`
              : 'Position shoulders within frame'}
          </span>

          {!isScanning && onRescan && (
            <>
              <span className="text-[#3A3F52]">|</span>
              <button
                onClick={onRescan}
                title="Rescan body measurements"
                className="text-[10px] font-mono text-[#10B981] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Rescan</span>
              </button>
            </>
          )}
        </div>

        {/* Phase 1 Linear Scan Progress Indicator */}
        {isScanning && (
          <div className="w-64 sm:w-80 h-1 bg-[#222530] rounded-full overflow-hidden backdrop-blur-sm border border-[#3A3F52]/50 shadow-sm">
            <div
              className="h-full bg-[#10B981] transition-all duration-100 ease-out"
              style={{ width: `${dimensions.stabilityProgress || 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Frame Corners & Mannequin Hairline Reticles */}
      <div className="relative w-full h-full my-auto pointer-events-none">
        {/* Top-left reticle */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-[#222530]" />
        {/* Top-right reticle */}
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[#222530]" />
        {/* Bottom-left reticle */}
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[#222530]" />
        {/* Bottom-right reticle */}
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-[#222530]" />

        {/* Studio Mannequin Hairline Torso Silhouette Guide (Visible during scanning) */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-opacity">
            <svg
              className="w-64 h-80 sm:w-72 sm:h-96 stroke-[#E2E8F0]"
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

      {/* Floating Monospaced Telemetry Bar (Bottom HUD) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto pb-12 sm:pb-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Shoulder Chip */}
          <div className="bg-[#131418]/90 border border-[#222530] px-2.5 py-1 rounded text-[11px] font-mono tabular-nums flex items-center gap-1.5 backdrop-blur-sm">
            <span className="text-[#7E8294] uppercase tracking-wider text-[10px]">SHOULDER</span>
            <span className="text-[#F5F5F7] font-medium">{shoulderVal}</span>
          </div>

          {/* Torso Chip */}
          <div className="bg-[#131418]/90 border border-[#222530] px-2.5 py-1 rounded text-[11px] font-mono tabular-nums flex items-center gap-1.5 backdrop-blur-sm">
            <span className="text-[#7E8294] uppercase tracking-wider text-[10px]">TORSO</span>
            <span className="text-[#F5F5F7] font-medium">{torsoVal}</span>
          </div>

          {/* Chest Chip */}
          <div className="bg-[#131418]/90 border border-[#222530] px-2.5 py-1 rounded text-[11px] font-mono tabular-nums flex items-center gap-1.5 backdrop-blur-sm">
            <span className="text-[#7E8294] uppercase tracking-wider text-[10px]">EST. CHEST</span>
            <span className="text-[#F5F5F7] font-medium">{chestVal}</span>
          </div>

          {/* Distance Chip */}
          <div className="bg-[#131418]/90 border border-[#222530] px-2.5 py-1 rounded text-[11px] font-mono tabular-nums flex items-center gap-1.5 backdrop-blur-sm">
            <span className="text-[#7E8294] uppercase tracking-wider text-[10px]">RANGE</span>
            <span className="text-[#F5F5F7] font-medium">{dimensions.distanceEstimateM.toFixed(1)}m</span>
          </div>
        </div>

        {/* Unit Toggle and Simulation Tag */}
        <div className="flex items-center gap-2">
          {isSimulated && (
            <span className="bg-[#131418] border border-[#222530] text-[#7E8294] px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider">
              STUDIO SIMULATOR
            </span>
          )}
          <button
            onClick={onToggleUnit}
            className="bg-[#131418] border border-[#222530] hover:border-[#3A3F52] px-2 py-1 rounded text-[10px] font-mono text-[#F5F5F7] tracking-wider transition-colors cursor-pointer"
          >
            {unit === 'metric' ? 'CM / METRIC' : 'IN / IMPERIAL'}
          </button>
        </div>
      </div>
    </div>
  );
};
