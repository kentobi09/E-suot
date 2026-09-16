import React from 'react';
import { X, ShieldCheck, Scale, AlertCircle } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131418] border border-[#222530] w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-md shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222530]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <h2 className="text-sm font-semibold tracking-wider uppercase text-[#F5F5F7]">
              Legal, Privacy & Compliance Architecture
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#7E8294] hover:text-[#F5F5F7] p-1 rounded hover:bg-[#222530] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 text-xs text-[#F5F5F7]/90 leading-relaxed font-sans">
          {/* Section 1: Biometric Privacy */}
          <div className="space-y-2 border-l-2 border-[#10B981] pl-3.5">
            <div className="flex items-center gap-2 text-[#F5F5F7] font-medium text-xs">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span className="uppercase tracking-wider font-mono text-[11px]">
                1. Biometric Privacy Disclosure (Mandatory Notice)
              </span>
            </div>
            <p className="text-[#F5F5F7] font-mono text-[11px] leading-relaxed bg-[#0A0A0C] p-3 rounded border border-[#222530]">
              “Zero Biometric Storage. Video processing and skeletal landmark calculations are executed 100% client-side inside your browser&apos;s local WebAssembly memory. No video streams, photos, or physical measurements are ever transmitted to or stored on external servers.”
            </p>
            <p className="text-[#7E8294] text-[11px]">
              E-suot utilizes MediaPipe Pose running entirely sandboxed within your browser’s WebGL/WASM runtime. The video frames are processed transiently in volatile RAM and discarded immediately after landmark extraction.
            </p>
          </div>

          {/* Section 2: Trademark & Fair Use */}
          <div className="space-y-2 border-l-2 border-[#7E8294] pl-3.5">
            <div className="flex items-center gap-2 text-[#F5F5F7] font-medium text-xs">
              <Scale className="w-4 h-4 text-[#7E8294]" />
              <span className="uppercase tracking-wider font-mono text-[11px]">
                2. Third-Party Trademark & E-Commerce Disclaimer
              </span>
            </div>
            <p className="text-[#7E8294] text-[11px] leading-relaxed">
              Nominative Fair Use Clause: Any referenced brand names, product titles, or third-party garment imagery uploaded, linked, or simulated by the user are the intellectual property and trademarks of their respective owners. E-suot is an independent digital visualization utility and is not affiliated with, sponsored by, or officially endorsed by any commercial fashion retailer or apparel house.
            </p>
          </div>

          {/* Section 3: Fit Estimation */}
          <div className="space-y-2 border-l-2 border-[#E2E8F0] pl-3.5">
            <div className="flex items-center gap-2 text-[#F5F5F7] font-medium text-xs">
              <AlertCircle className="w-4 h-4 text-[#E2E8F0]" />
              <span className="uppercase tracking-wider font-mono text-[11px]">
                3. Mathematical Fit Estimation Notice
              </span>
            </div>
            <p className="text-[#7E8294] text-[11px] leading-relaxed">
              Sizes, dimensions (shoulder width, torso drop, chest circumference), and virtual garment drape overlays are mathematical approximations generated through monocular perspective geometry and computer vision keypoint telemetry. They are intended for aesthetic visualization and editorial styling exploration only, and do not replace physical bespoke tailor fittings or certified garment sizing charts.
            </p>
          </div>

          {/* Device & Camera Permission Rationale */}
          <div className="p-3 bg-[#0A0A0C] border border-[#222530] rounded text-[10px] text-[#7E8294] space-y-1 font-mono">
            <div className="text-[#F5F5F7] font-semibold">LOCAL RUNTIME VERIFICATION</div>
            <div>STATUS: ZERO OUTBOUND TELEMETRY DETECTED</div>
            <div>ISOLATION: CLIENT-SIDE WASM WORKER THREAD</div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#222530] bg-[#0A0A0C] flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#7E8294]">
            STUDIO E-SUOT COMPLIANCE FRAMEWORK v2.4
          </span>
          <button
            onClick={onClose}
            className="bg-[#131418] hover:bg-[#222530] border border-[#222530] text-[#F5F5F7] text-[11px] font-medium px-4 py-1.5 rounded transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
