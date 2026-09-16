import React, { useState, useRef } from 'react';
import { X, Upload, Check, Camera } from 'lucide-react';
import { GarmentItem } from '../lib/types';
import { GARMENT_PRESETS } from '../lib/garmentPresets';
import { garmentFitter } from '../lib/garmentFitter';

interface GarmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGarment: GarmentItem;
  onSelectGarment: (garment: GarmentItem) => void;
  onCustomGarmentLoaded: (canvas: HTMLCanvasElement | HTMLImageElement, garment: GarmentItem) => void;
  onOpenScannerModal: () => void;
}

export const GarmentDrawer: React.FC<GarmentDrawerProps> = ({
  isOpen,
  onClose,
  selectedGarment,
  onSelectGarment,
  onCustomGarmentLoaded,
  onOpenScannerModal
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [bgThreshold, setBgThreshold] = useState(38);
  const [featherEdges, setFeatherEdges] = useState(true);
  const [isProcessingCutout, setIsProcessingCutout] = useState(false);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'upload' | 'refine'>('wardrobe');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'tops' | 'bottoms'>('all');
  const [importCategory, setImportCategory] = useState<'tops' | 'bottoms'>('tops');
  const [rawUploadedImage, setRawUploadedImage] = useState<HTMLImageElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle URL Ingestion
  const handleLoadUrl = async () => {
    if (!urlInput.trim()) return;
    setIsLoadingUrl(true);
    setUrlError(null);

    const tryLoad = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
      });
    };

    try {
      let loadedImg: HTMLImageElement;
      try {
        // Try direct load first
        loadedImg = await tryLoad(urlInput.trim());
      } catch {
        // Fallback to CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput.trim())}`;
        loadedImg = await tryLoad(proxyUrl);
      }

      setRawUploadedImage(loadedImg);
      applyCutoutAndSetGarment(loadedImg, 'URL Product Ingestion');
      setActiveTab('refine');
    } catch (err: any) {
      console.error(err);
      setUrlError('Unable to load image due to CORS or invalid URL. Try uploading the downloaded image directly.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Handle Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setRawUploadedImage(img);
        applyCutoutAndSetGarment(img, file.name.replace(/\.[^/.]+$/, ''));
        setActiveTab('refine');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Apply Client-Side Cutout Mask
  const applyCutoutAndSetGarment = (img: HTMLImageElement, name: string) => {
    setIsProcessingCutout(true);
    setTimeout(() => {
      try {
        const cutoutCanvas = garmentFitter.processBackgroundRemoval(img, bgThreshold, featherEdges);

        // Extract dominant/average color from non-transparent cutout pixels
        let extractedHex = '#8E8E93';
        try {
          const ctx = cutoutCanvas.getContext('2d');
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, cutoutCanvas.width, cutoutCanvas.height);
            const d = imgData.data;
            let rSum = 0, gSum = 0, bSum = 0, validPixels = 0;
            const step = Math.max(1, Math.floor(d.length / 40000)) * 4;
            for (let i = 0; i < d.length; i += step) {
              const a = d[i + 3];
              if (a > 60) {
                rSum += d[i];
                gSum += d[i + 1];
                bSum += d[i + 2];
                validPixels++;
              }
            }
            if (validPixels > 0) {
              const avgR = Math.round(rSum / validPixels);
              const avgG = Math.round(gSum / validPixels);
              const avgB = Math.round(bSum / validPixels);
              extractedHex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
            }
          }
        } catch (e) {
          console.warn('Color extraction fallback:', e);
        }

        const isBottom = importCategory === 'bottoms';
        const customGarment: GarmentItem = {
          id: `custom-${Date.now()}`,
          name: name,
          category: isBottom ? 'bottoms' : 'tops',
          editorialCode: `CST-${Math.floor(100 + Math.random() * 900)}`,
          brand: 'USER ATELIER',
          colorName: `${isBottom ? 'Custom Pants' : 'Custom Top'} (${extractedHex.toUpperCase()})`,
          hex: extractedHex,
          description: `Client-ingested 3D ${isBottom ? 'bottoms' : 'top'} cut out via threshold isolation.`,
          fabricSpec: 'Dynamic 3D Source',
          silhouette: 'Regular',
          imageUrl: cutoutCanvas.toDataURL('image/png'),
          aspectRatio: cutoutCanvas.width / cutoutCanvas.height,
          anchorPointRatio: { x: 0.5, y: isBottom ? 0.05 : 0.12 },
          shoulderSpanRatio: 0.65,
          scaleFactor: 1.0,
          offsetYFactor: 0.0,
          availableSizes: ['S', 'M', 'L', 'XL'],
          defaultSize: 'M',
          sizeChart: {
            S: { chestCm: 100, shoulderCm: 45, lengthCm: 70 },
            M: { chestCm: 106, shoulderCm: 47, lengthCm: 72 },
            L: { chestCm: 112, shoulderCm: 49, lengthCm: 74 },
            XL: { chestCm: 118, shoulderCm: 51, lengthCm: 76 }
          }
        };

        onCustomGarmentLoaded(cutoutCanvas, customGarment);
        onSelectGarment(customGarment);
      } catch (err) {
        console.error('Failed to process cutout:', err);
      } finally {
        setIsProcessingCutout(false);
      }
    }, 50);
  };

  const reprocessCurrentRawImage = () => {
    if (rawUploadedImage) {
      applyCutoutAndSetGarment(rawUploadedImage, selectedGarment.name);
    }
  };

  const filteredPresets = GARMENT_PRESETS.filter((item) => {
    if (categoryFilter === 'tops') return item.category !== 'bottoms';
    if (categoryFilter === 'bottoms') return item.category === 'bottoms';
    return true;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-[#111216] border-l border-[#222530] shadow-2xl flex flex-col transition-transform duration-300 ease-out">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#222530] bg-[#0E0F12]">
        <div>
          <div className="text-xs font-mono text-[#F5F5F7] font-semibold tracking-wider uppercase">
            WARDROBE SELECTION
          </div>
          <div className="text-[10px] font-mono text-[#7E8294]">
            STUDIO FLAT-LAY REPOSITORY
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#7E8294] hover:text-[#F5F5F7] p-1.5 rounded hover:bg-[#222530] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#222530] bg-[#0A0A0C]">
        <button
          onClick={() => setActiveTab('wardrobe')}
          className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'wardrobe'
              ? 'text-[#F5F5F7] border-b-2 border-[#E2E8F0] font-semibold bg-[#131418]'
              : 'text-[#7E8294] hover:text-[#F5F5F7]'
          }`}
        >
          Presets ({GARMENT_PRESETS.length})
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'upload'
              ? 'text-[#F5F5F7] border-b-2 border-[#E2E8F0] font-semibold bg-[#131418]'
              : 'text-[#7E8294] hover:text-[#F5F5F7]'
          }`}
        >
          Ingest / URL
        </button>
        {rawUploadedImage && (
          <button
            onClick={() => setActiveTab('refine')}
            className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'refine'
                ? 'text-[#F5F5F7] border-b-2 border-[#E2E8F0] font-semibold bg-[#131418]'
                : 'text-[#7E8294] hover:text-[#F5F5F7]'
            }`}
          >
            Cutout Mask
          </button>
        )}
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tab 1: Wardrobe Presets */}
        {activeTab === 'wardrobe' && (
          <div className="space-y-4">
            <button
              onClick={onOpenScannerModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1A1C23] hover:bg-[#222530] border border-[#222530] hover:border-[#10B981] rounded text-xs font-mono text-[#F5F5F7] transition-all cursor-pointer shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Snap Clothes with Camera (Flat Lay / Worn)</span>
            </button>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 pt-1 pb-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full border transition-all cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-[#F5F5F7] text-[#0A0A0C] border-[#F5F5F7] font-semibold'
                    : 'bg-[#15171E] text-[#8E92A4] border-[#252834] hover:border-[#3E4254]'
                }`}
              >
                All Pieces
              </button>
              <button
                onClick={() => setCategoryFilter('tops')}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full border transition-all cursor-pointer ${
                  categoryFilter === 'tops'
                    ? 'bg-[#F5F5F7] text-[#0A0A0C] border-[#F5F5F7] font-semibold'
                    : 'bg-[#15171E] text-[#8E92A4] border-[#252834] hover:border-[#3E4254]'
                }`}
              >
                Tops / Shirts
              </button>
              <button
                onClick={() => setCategoryFilter('bottoms')}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full border transition-all cursor-pointer ${
                  categoryFilter === 'bottoms'
                    ? 'bg-[#F5F5F7] text-[#0A0A0C] border-[#F5F5F7] font-semibold'
                    : 'bg-[#15171E] text-[#8E92A4] border-[#252834] hover:border-[#3E4254]'
                }`}
              >
                Pants / Bottoms
              </button>
            </div>

            <div className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider">
              CURATED EDITORIAL PIECES ({filteredPresets.length})
            </div>

            <div className="space-y-3">
              {filteredPresets.map((item) => {
                const isSelected = selectedGarment.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectGarment(item)}
                    className={`p-3.5 rounded-md border transition-all cursor-pointer flex gap-4 items-center ${
                      isSelected
                        ? 'bg-[#1A1C23] border-[#E2E8F0]'
                        : 'bg-[#0A0A0C] border-[#222530] hover:border-[#3A3F52]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-20 bg-[#131418] border border-[#222530] rounded flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#7E8294]">
                          {item.editorialCode}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-[#10B981] flex items-center gap-1">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#F5F5F7] truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#7E8294] truncate">
                        {item.fabricSpec}
                      </div>
                      <div className="text-[10px] font-mono text-[#E2E8F0] pt-0.5">
                        Silhouette: {item.silhouette}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: URL & Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Garment Classification Switcher */}
            <div className="p-3 bg-[#131418] border border-[#222530] rounded-md flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#7E8294] uppercase tracking-wider">Garment Category:</span>
              <div className="flex gap-1.5 bg-[#0A0A0C] p-1 rounded border border-[#222530]">
                <button
                  type="button"
                  onClick={() => setImportCategory('tops')}
                  className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer ${
                    importCategory === 'tops'
                      ? 'bg-[#E2E8F0] text-[#0A0A0C] font-semibold'
                      : 'text-[#7E8294] hover:text-[#F5F5F7]'
                  }`}
                >
                  Tops / Shirts
                </button>
                <button
                  type="button"
                  onClick={() => setImportCategory('bottoms')}
                  className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer ${
                    importCategory === 'bottoms'
                      ? 'bg-[#E2E8F0] text-[#0A0A0C] font-semibold'
                      : 'text-[#7E8294] hover:text-[#F5F5F7]'
                  }`}
                >
                  Pants / Bottoms
                </button>
              </div>
            </div>

            {/* Camera Snap Card */}
            <div className="p-4 bg-[#0A0A0C] border border-[#222530] rounded-md space-y-2.5">
              <div className="text-[11px] font-mono text-[#E2E8F0] font-semibold flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-[#10B981]" />
                <span>SNAP WITH PHONE / WEBCAM</span>
              </div>
              <p className="text-[10px] text-[#7E8294] leading-relaxed">
                Take a live photo of a flat-laid shirt or worn clothing. E-suot isolates the background automatically on your device.
              </p>
              <button
                onClick={onOpenScannerModal}
                className="w-full py-2 bg-[#1A1C23] hover:bg-[#222530] border border-[#222530] hover:border-[#10B981] rounded text-xs font-mono text-[#F5F5F7] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3 h-3 text-[#10B981]" />
                <span>Launch Garment Digitizer</span>
              </button>
            </div>

            {/* URL Ingestion */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider block">
                PASTE PRODUCT IMAGE LINK
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://example.com/product-shirt.jpg"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full bg-[#0A0A0C] border border-[#222530] focus:border-[#E2E8F0] text-xs text-[#F5F5F7] px-3 py-2 rounded font-mono outline-none"
                  />
                </div>
                <button
                  onClick={handleLoadUrl}
                  disabled={isLoadingUrl || !urlInput.trim()}
                  className="bg-[#E2E8F0] hover:bg-white disabled:opacity-40 text-[#0A0A0C] text-xs font-semibold px-3 py-2 rounded transition-colors cursor-pointer shrink-0"
                >
                  {isLoadingUrl ? 'Ingesting...' : 'Ingest'}
                </button>
              </div>
              {urlError && (
                <div className="text-[11px] text-[#EF4444] font-mono leading-tight pt-1">
                  {urlError}
                </div>
              )}
              <p className="text-[10px] text-[#7E8294]">
                Instant CORS proxy fallback included. Works best with clean flat-lay product catalog imagery.
              </p>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#222530]" />
              <span className="flex-shrink mx-3 text-[10px] font-mono text-[#7E8294] uppercase">
                OR LOCAL FILE
              </span>
              <div className="flex-grow border-t border-[#222530]" />
            </div>

            {/* Drag and Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#222530] hover:border-[#E2E8F0] rounded-md p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#0A0A0C]/50 hover:bg-[#0A0A0C]"
            >
              <Upload className="w-6 h-6 text-[#7E8294]" />
              <div className="text-xs font-medium text-[#F5F5F7]">
                Click or Drop Flat-lay Image
              </div>
              <div className="text-[10px] font-mono text-[#7E8294]">
                PNG (transparent preferred), JPG, WEBP
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Cutout Refinement */}
        {activeTab === 'refine' && rawUploadedImage && (
          <div className="space-y-4">
            <div className="text-[11px] font-mono uppercase text-[#7E8294] tracking-wider">
              BACKGROUND REMOVAL & THRESHOLD
            </div>

            <div className="p-3 bg-[#0A0A0C] border border-[#222530] rounded space-y-4">
              {/* Tolerance Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#7E8294]">MASK TOLERANCE</span>
                  <span className="text-[#F5F5F7] tabular-nums">{bgThreshold}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={bgThreshold}
                  onChange={(e) => setBgThreshold(Number(e.target.value))}
                  onMouseUp={reprocessCurrentRawImage}
                  onTouchEnd={reprocessCurrentRawImage}
                  className="w-full accent-[#E2E8F0] cursor-pointer"
                />
              </div>

              {/* Feather Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono text-[#7E8294]">SOFT EDGE FEATHER</span>
                <button
                  onClick={() => {
                    setFeatherEdges(!featherEdges);
                    setTimeout(reprocessCurrentRawImage, 10);
                  }}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    featherEdges
                      ? 'bg-[#E2E8F0] text-[#0A0A0C] font-semibold'
                      : 'bg-[#1A1C23] text-[#7E8294] border border-[#222530]'
                  }`}
                >
                  {featherEdges ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <button
                onClick={reprocessCurrentRawImage}
                disabled={isProcessingCutout}
                className="w-full bg-[#1A1C23] hover:bg-[#222530] text-[#F5F5F7] text-xs font-mono py-2 rounded border border-[#222530] transition-colors cursor-pointer"
              >
                {isProcessingCutout ? 'Recalculating Alpha Mask...' : 'Update Cutout Mask'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Spec Notice */}
      <div className="p-4 border-t border-[#222530] bg-[#0A0A0C] text-[10px] font-mono text-[#7E8294]">
        ACTIVE ITEM: <span className="text-[#F5F5F7]">{selectedGarment.name}</span>
      </div>
    </div>
  );
};
