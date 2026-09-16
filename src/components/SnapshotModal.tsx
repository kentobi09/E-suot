import React from 'react';
import { X, Download, Camera, Check } from 'lucide-react';
import { SnapshotData } from '../lib/types';

interface SnapshotModalProps {
  snapshot: SnapshotData | null;
  onClose: () => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({ snapshot, onClose }) => {
  const [downloaded, setDownloaded] = React.useState(false);

  if (!snapshot) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `e-suot-fitting-${Date.now()}.png`;
    link.href = snapshot.dataUrl;
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#131418] border border-[#222530] w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-md shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#222530]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#F5F5F7]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#F5F5F7]">
              LOOKBOOK SPEC // FIT SNAPSHOT RECORD
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#7E8294] hover:text-[#F5F5F7] p-1 rounded hover:bg-[#222530] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Captured Canvas Image */}
          <div className="relative rounded border border-[#222530] bg-[#0A0A0C] overflow-hidden flex items-center justify-center aspect-[4/3]">
            <img
              src={snapshot.dataUrl}
              alt="Fitting room snapshot"
              className="w-full h-full object-contain"
            />
            {/* Timestamp Badge */}
            <div className="absolute top-3 left-3 bg-[#0A0A0C]/80 border border-[#222530] px-2.5 py-1 rounded text-[10px] font-mono text-[#7E8294]">
              {snapshot.timestamp}
            </div>
            {/* Garment Tag */}
            <div className="absolute top-3 right-3 bg-[#0A0A0C]/80 border border-[#222530] px-2.5 py-1 rounded text-[10px] font-mono text-[#F5F5F7]">
              {snapshot.garment.editorialCode} • SIZE {snapshot.size}
            </div>
          </div>

          {/* Editorial Spec Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            <div className="bg-[#0A0A0C] border border-[#222530] p-2.5 rounded">
              <div className="text-[10px] font-mono text-[#7E8294] uppercase tracking-wider">
                SHOULDER BREADTH
              </div>
              <div className="text-xs font-mono font-medium text-[#F5F5F7] tabular-nums mt-0.5">
                {snapshot.dimensions.shoulderWidthCm.toFixed(1)} cm / {snapshot.dimensions.shoulderWidthIn.toFixed(1)}&quot;
              </div>
            </div>

            <div className="bg-[#0A0A0C] border border-[#222530] p-2.5 rounded">
              <div className="text-[10px] font-mono text-[#7E8294] uppercase tracking-wider">
                TORSO DROP
              </div>
              <div className="text-xs font-mono font-medium text-[#F5F5F7] tabular-nums mt-0.5">
                {snapshot.dimensions.torsoLengthCm.toFixed(1)} cm / {snapshot.dimensions.torsoLengthIn.toFixed(1)}&quot;
              </div>
            </div>

            <div className="bg-[#0A0A0C] border border-[#222530] p-2.5 rounded">
              <div className="text-[10px] font-mono text-[#7E8294] uppercase tracking-wider">
                CHEST GIRTH
              </div>
              <div className="text-xs font-mono font-medium text-[#F5F5F7] tabular-nums mt-0.5">
                {snapshot.dimensions.chestCircumferenceCm.toFixed(1)} cm / {snapshot.dimensions.chestCircumferenceIn.toFixed(1)}&quot;
              </div>
            </div>

            <div className="bg-[#0A0A0C] border border-[#222530] p-2.5 rounded">
              <div className="text-[10px] font-mono text-[#7E8294] uppercase tracking-wider">
                FIT ENGINE
              </div>
              <div className="text-xs font-mono font-medium text-[#10B981] uppercase mt-0.5">
                {snapshot.fitEngine === 'mesh' ? 'Adaptive Mesh' : 'Quick Affine'}
              </div>
            </div>
          </div>

          {/* Garment Details */}
          <div className="bg-[#0A0A0C] border border-[#222530] p-3.5 rounded text-xs space-y-1">
            <div className="flex items-center justify-between text-[#F5F5F7]">
              <span className="font-semibold">{snapshot.garment.name}</span>
              <span className="font-mono text-[#7E8294] text-[11px]">{snapshot.garment.brand}</span>
            </div>
            <div className="text-[#7E8294] text-[11px]">{snapshot.garment.fabricSpec}</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#222530] bg-[#0A0A0C] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-[#7E8294] hover:text-[#F5F5F7] transition-colors cursor-pointer"
          >
            Discard Snapshot
          </button>
          <button
            onClick={handleDownload}
            className="bg-[#E2E8F0] hover:bg-white text-[#0A0A0C] text-xs font-semibold px-4 py-1.5 rounded flex items-center gap-2 transition-colors cursor-pointer"
          >
            {downloaded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Studio Card</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
