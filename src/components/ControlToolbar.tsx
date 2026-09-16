import React from 'react';
import {
  Camera,
  Shirt,
  Sparkles,
  Shield,
  Layers,
  Activity,
  Cpu
} from 'lucide-react';
import { FitEngineMode } from '../lib/types';

interface ControlToolbarProps {
  opacity: number;
  onOpacityChange: (val: number) => void;
  selectedSize: string;
  onSizeChange: (size: string) => void;
  availableSizes: string[];
  wireframeOnly: boolean;
  onToggleWireframe: () => void;
  fitEngine: FitEngineMode;
  onToggleFitEngine: () => void;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  onTakeSnapshot: () => void;
  onOpenWardrobe: () => void;
  onOpenRecommendations: () => void;
  onOpenLegal: () => void;
}

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  opacity,
  onOpacityChange,
  selectedSize,
  onSizeChange,
  availableSizes,
  wireframeOnly,
  onToggleWireframe,
  fitEngine,
  onToggleFitEngine,
  showLandmarks,
  onToggleLandmarks,
  onTakeSnapshot,
  onOpenWardrobe,
  onOpenRecommendations,
  onOpenLegal
}) => {
  return (
    <nav aria-label="Fitting room controls" className="fixed bottom-4 inset-x-0 z-30 flex justify-center px-4 pointer-events-none">
      <div className="bg-[#131418]/95 border border-[#222530] rounded-md shadow-2xl backdrop-blur-md px-3 py-1.5 flex items-center gap-2 sm:gap-3 pointer-events-auto h-[42px] max-w-full overflow-x-auto">
        {/* Wardrobe Drawer Button */}
        <button
          onClick={onOpenWardrobe}
          title="Open Wardrobe & Garment Ingestion"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[#F5F5F7] bg-[#1A1C23] hover:bg-[#222530] border border-[#222530] hover:border-[#3A3F52] rounded transition-colors cursor-pointer shrink-0"
        >
          <Shirt className="w-3.5 h-3.5 text-[#E2E8F0]" />
          <span className="hidden md:inline">Wardrobe</span>
        </button>

        <div className="w-[1px] h-4 bg-[#222530] shrink-0" />

        {/* Size Selector */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono text-[#7E8294] uppercase mr-1 hidden sm:inline">
            SIZE:
          </span>
          {availableSizes.map((sz) => {
            const isActive = selectedSize === sz;
            return (
              <button
                key={sz}
                onClick={() => onSizeChange(sz)}
                className={`w-6 h-6 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-[#E2E8F0] text-[#0A0A0C] font-bold'
                    : 'text-[#7E8294] hover:text-[#F5F5F7] hover:bg-[#1A1C23]'
                }`}
              >
                {sz}
              </button>
            );
          })}
        </div>

        <div className="w-[1px] h-4 bg-[#222530] shrink-0" />

        {/* Opacity Slider */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-[#7E8294] uppercase hidden lg:inline">
            OPACITY:
          </span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-[#E2E8F0] cursor-pointer"
            title={`Garment Opacity: ${Math.round(opacity * 100)}%`}
          />
          <span className="text-[10px] font-mono text-[#F5F5F7] w-7 tabular-nums">
            {Math.round(opacity * 100)}%
          </span>
        </div>

        <div className="w-[1px] h-4 bg-[#222530] shrink-0" />

        {/* Fit Engine Toggle (Adaptive Mesh vs Quick Affine) */}
        <button
          onClick={onToggleFitEngine}
          title={`Active Engine: ${fitEngine === 'mesh' ? 'Adaptive Curvature Mesh' : '2D Quick Affine'}`}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer shrink-0 ${
            fitEngine === 'mesh'
              ? 'bg-[#1A1C23] border-[#3A3F52] text-[#F5F5F7]'
              : 'border-transparent text-[#7E8294] hover:text-[#F5F5F7]'
          }`}
        >
          <Cpu className="w-3 h-3 text-[#10B981]" />
          <span className="hidden xl:inline">{fitEngine === 'mesh' ? 'Adaptive Mesh' : 'Quick Fit'}</span>
        </button>

        {/* Wireframe Toggle */}
        <button
          onClick={onToggleWireframe}
          title="Toggle Wireframe Alignment View"
          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer shrink-0 ${
            wireframeOnly
              ? 'bg-[#E2E8F0] text-[#0A0A0C] border-[#E2E8F0] font-semibold'
              : 'border-transparent text-[#7E8294] hover:text-[#F5F5F7]'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span className="hidden xl:inline">Wireframe</span>
        </button>

        {/* Landmarks / Skeleton Toggle */}
        <button
          onClick={onToggleLandmarks}
          title="Toggle Skeletal Keypoints"
          className={`p-1.5 rounded transition-colors cursor-pointer shrink-0 ${
            showLandmarks
              ? 'text-[#F5F5F7] bg-[#1A1C23]'
              : 'text-[#7E8294] hover:text-[#F5F5F7]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-[#222530] shrink-0" />

        {/* Freeze / Snapshot Button */}
        <button
          onClick={onTakeSnapshot}
          title="Freeze & Snapshot Fit"
          className="flex items-center gap-1.5 px-3 py-1 bg-[#E2E8F0] hover:bg-white text-[#0A0A0C] text-xs font-semibold rounded transition-colors cursor-pointer shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Freeze</span>
        </button>

        {/* Recommendations Drawer Toggle */}
        <button
          onClick={onOpenRecommendations}
          title="Open Sizing & Fit Recommendations"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[#F5F5F7] bg-[#1A1C23] hover:bg-[#222530] border border-[#222530] hover:border-[#3A3F52] rounded transition-colors cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="hidden md:inline">Advisor</span>
        </button>

        {/* Legal & Privacy Compliance */}
        <button
          onClick={onOpenLegal}
          title="Legal & Biometric Privacy Policy"
          className="p-1.5 text-[#7E8294] hover:text-[#F5F5F7] rounded hover:bg-[#1A1C23] transition-colors cursor-pointer shrink-0"
        >
          <Shield className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};
