import React from 'react';
import { X, Sparkles, Check, ChevronRight, Sliders } from 'lucide-react';
import { BodyDimensions, GarmentItem, SilhouettePreference } from '../lib/types';
import { computeFitRecommendation, LUXURY_SIZE_STANDARDS } from '../lib/recommendations';

interface RecommendationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dimensions: BodyDimensions;
  currentGarment: GarmentItem;
  selectedSize: string;
  onSelectSize: (size: string) => void;
  silhouettePreference: SilhouettePreference;
  onChangeSilhouette: (pref: SilhouettePreference) => void;
}

export const RecommendationDrawer: React.FC<RecommendationDrawerProps> = ({
  isOpen,
  onClose,
  dimensions,
  currentGarment,
  selectedSize,
  onSelectSize,
  silhouettePreference,
  onChangeSilhouette
}) => {
  if (!isOpen) return null;

  const recommendation = computeFitRecommendation(dimensions, currentGarment, silhouettePreference);
  const sizeChart = currentGarment.sizeChart;
  const sizes = Object.keys(sizeChart);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[460px] bg-[#131418] border-l border-[#222530] shadow-2xl flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#222530] bg-[#0A0A0C]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <div>
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#F5F5F7]">
              E-SUOT FIT & SIZING ADVISOR
            </h2>
            <div className="text-[10px] font-mono text-[#7E8294]">
              ANTHROPOMETRIC SILHOUETTE ANALYSIS
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#7E8294] hover:text-[#F5F5F7] p-1.5 rounded hover:bg-[#222530] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Recommendation Hero Banner */}
        <div className="bg-[#0A0A0C] border border-[#222530] p-4 rounded-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-[#7E8294] tracking-wider">
              OPTIMAL RECOMMENDATION
            </span>
            <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 px-2 py-0.5 rounded text-[10px] font-mono">
              {recommendation.matchScore}% MATCH
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-mono font-bold text-[#F5F5F7]">
              SIZE {recommendation.recommendedSize}
            </span>
            <span className="text-xs font-mono text-[#7E8294]">
              ({recommendation.status.toUpperCase()})
            </span>
          </div>

          <p className="text-xs text-[#7E8294] leading-relaxed">
            Based on your live measurement telemetry, size{' '}
            <strong className="text-[#F5F5F7]">{recommendation.recommendedSize}</strong> provides the intended{' '}
            <span className="text-[#E2E8F0] lowercase">{currentGarment.silhouette}</span> drape.
          </p>

          {recommendation.recommendedSize !== selectedSize && (
            <button
              onClick={() => onSelectSize(recommendation.recommendedSize)}
              className="w-full mt-2 bg-[#E2E8F0] hover:bg-white text-[#0A0A0C] text-xs font-semibold py-2 px-3 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Apply Recommended Size {recommendation.recommendedSize} to Mirror</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Silhouette Preference Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#7E8294]">
            <span>INTENDED SILHOUETTE</span>
            <span>EASE VARIANCE</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['tailored', 'regular', 'oversized'] as SilhouettePreference[]).map((pref) => {
              const active = silhouettePreference === pref;
              return (
                <button
                  key={pref}
                  onClick={() => onChangeSilhouette(pref)}
                  className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1A1C23] border-[#E2E8F0] text-[#F5F5F7]'
                      : 'bg-[#0A0A0C] border-[#222530] text-[#7E8294] hover:border-[#3A3F52]'
                  }`}
                >
                  <div className="text-[11px] font-semibold capitalize">{pref}</div>
                  <div className="text-[9px] font-mono text-[#7E8294] mt-0.5">
                    {pref === 'tailored' ? '+6cm ease' : pref === 'regular' ? '+10cm ease' : '+18cm ease'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Anthropometric vs Garment Spec Table */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider">
            MEASUREMENT DELTA VS GARMENT SPEC
          </div>

          <div className="border border-[#222530] rounded-md overflow-hidden bg-[#0A0A0C]">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-[#222530] text-[#7E8294] text-[10px] uppercase">
                  <th className="text-left py-2 px-3 font-normal">DIMENSION</th>
                  <th className="text-right py-2 px-3 font-normal">BODY</th>
                  <th className="text-right py-2 px-3 font-normal">
                    SPEC ({selectedSize})
                  </th>
                  <th className="text-right py-2 px-3 font-normal">DELTA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222530]/60 tabular-nums">
                <tr>
                  <td className="py-2 px-3 text-[#7E8294]">Shoulder Span</td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {dimensions.shoulderWidthCm.toFixed(1)} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {sizeChart[selectedSize]?.shoulderCm ?? '-'} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#10B981]">
                    {sizeChart[selectedSize]
                      ? `+${(sizeChart[selectedSize].shoulderCm - dimensions.shoulderWidthCm).toFixed(1)} cm`
                      : '-'}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-[#7E8294]">Chest Girth</td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {dimensions.chestCircumferenceCm.toFixed(1)} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {sizeChart[selectedSize]?.chestCm ?? '-'} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#10B981]">
                    {sizeChart[selectedSize]
                      ? `+${(sizeChart[selectedSize].chestCm - dimensions.chestCircumferenceCm).toFixed(1)} cm`
                      : '-'}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-[#7E8294]">Torso Drop</td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {dimensions.torsoLengthCm.toFixed(1)} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#F5F5F7]">
                    {sizeChart[selectedSize]?.lengthCm ?? '-'} cm
                  </td>
                  <td className="py-2 px-3 text-right text-[#10B981]">
                    {sizeChart[selectedSize]
                      ? `+${(sizeChart[selectedSize].lengthCm - dimensions.torsoLengthCm).toFixed(1)} cm`
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Editorial Fit Notes */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider">
            EDITORIAL STYLING & FIT CRITIQUE
          </div>
          <div className="space-y-2">
            {recommendation.editorialNotes.map((note, idx) => (
              <div
                key={idx}
                className="bg-[#0A0A0C] border border-[#222530] p-3 rounded text-xs text-[#F5F5F7]/90 leading-relaxed font-sans flex items-start gap-2.5"
              >
                <span className="text-[#10B981] mt-0.5">•</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Standard Luxury Conversion Chart */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider">
            INTERNATIONAL SIZE EQUIVALENCY
          </div>
          <div className="grid grid-cols-6 gap-1 border border-[#222530] p-1.5 rounded-md bg-[#0A0A0C] text-center text-[10px] font-mono">
            {LUXURY_SIZE_STANDARDS.map((s) => {
              const isCurr = s.alpha === selectedSize;
              return (
                <div
                  key={s.alpha}
                  onClick={() => onSelectSize(s.alpha)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isCurr
                      ? 'bg-[#E2E8F0] text-[#0A0A0C] font-bold'
                      : 'hover:bg-[#1A1C23] text-[#7E8294]'
                  }`}
                >
                  <div className="text-xs">{s.alpha}</div>
                  <div className="text-[9px] opacity-80">EU {s.eu}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
