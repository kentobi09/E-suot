import { BodyDimensions, GarmentItem, FitRecommendation, SilhouettePreference } from './types';

export interface SizeStandardMapping {
  alpha: string;
  eu: number;
  usUk: number;
  chestMinCm: number;
  chestMaxCm: number;
  shoulderMinCm: number;
  shoulderMaxCm: number;
}

export const LUXURY_SIZE_STANDARDS: SizeStandardMapping[] = [
  { alpha: 'XS', eu: 44, usUk: 34, chestMinCm: 84, chestMaxCm: 89, shoulderMinCm: 41, shoulderMaxCm: 43 },
  { alpha: 'S',  eu: 46, usUk: 36, chestMinCm: 90, chestMaxCm: 95, shoulderMinCm: 43, shoulderMaxCm: 45 },
  { alpha: 'M',  eu: 48, usUk: 38, chestMinCm: 96, chestMaxCm: 102, shoulderMinCm: 45, shoulderMaxCm: 47 },
  { alpha: 'L',  eu: 50, usUk: 40, chestMinCm: 103, chestMaxCm: 109, shoulderMinCm: 47, shoulderMaxCm: 49 },
  { alpha: 'XL', eu: 52, usUk: 42, chestMinCm: 110, chestMaxCm: 116, shoulderMinCm: 49, shoulderMaxCm: 52 },
  { alpha: 'XXL', eu: 54, usUk: 44, chestMinCm: 117, chestMaxCm: 124, shoulderMinCm: 52, shoulderMaxCm: 55 },
];

export function computeFitRecommendation(
  dims: BodyDimensions,
  garment: GarmentItem,
  preference: SilhouettePreference = 'regular'
): FitRecommendation {
  const chart = garment.sizeChart;
  const sizes = Object.keys(chart);
  
  if (sizes.length === 0) {
    return {
      recommendedSize: 'M',
      silhouetteStyle: preference,
      matchScore: 85,
      shoulderDeltaCm: 0,
      chestDeltaCm: 0,
      lengthDeltaCm: 0,
      status: 'True Fit',
      editorialNotes: ['Standard baseline fit applied. Direct telemetry calibration ongoing.']
    };
  }

  // Target ease depending on preference
  let targetChestEase = 10; // cm of garment ease over body
  if (preference === 'tailored') targetChestEase = 6;
  if (preference === 'oversized') targetChestEase = 18;

  const targetGarmentChest = dims.chestCircumferenceCm + targetChestEase;

  // Find best matching size
  let bestSize = sizes[0];
  let minDiff = 999;
  let bestShoulderDelta = 0;
  let bestChestDelta = 0;
  let bestLengthDelta = 0;

  for (const size of sizes) {
    const spec = chart[size];
    const chestDiff = Math.abs(spec.chestCm - targetGarmentChest);
    const shoulderDiff = Math.abs(spec.shoulderCm - dims.shoulderWidthCm);
    const compositeDiff = chestDiff * 0.6 + shoulderDiff * 0.4;

    if (compositeDiff < minDiff) {
      minDiff = compositeDiff;
      bestSize = size;
      bestChestDelta = spec.chestCm - dims.chestCircumferenceCm;
      bestShoulderDelta = spec.shoulderCm - dims.shoulderWidthCm;
      bestLengthDelta = spec.lengthCm - dims.torsoLengthCm;
    }
  }

  // Alternative size (one up or one down)
  const bestIdx = sizes.indexOf(bestSize);
  let alternativeSize: string | undefined;
  if (preference === 'tailored' && bestIdx > 0) {
    alternativeSize = sizes[bestIdx - 1];
  } else if (preference === 'oversized' && bestIdx < sizes.length - 1) {
    alternativeSize = sizes[bestIdx + 1];
  } else if (bestIdx < sizes.length - 1) {
    alternativeSize = sizes[bestIdx + 1];
  }

  // Status classification
  let status: 'Snug' | 'True Fit' | 'Generous' | 'Oversized' = 'True Fit';
  if (bestChestDelta < 5) status = 'Snug';
  else if (bestChestDelta <= 11) status = 'True Fit';
  else if (bestChestDelta <= 18) status = 'Generous';
  else status = 'Oversized';

  // Editorial styling notes
  const editorialNotes: string[] = [];
  
  if (bestShoulderDelta < 1.0) {
    editorialNotes.push(`Natural acromion seam alignment with crisp, structured shoulder break (+${bestShoulderDelta.toFixed(1)}cm ease).`);
  } else if (bestShoulderDelta < 4.0) {
    editorialNotes.push(`Slight drop-shoulder drape (+${bestShoulderDelta.toFixed(1)}cm) offering contemporary relaxed volume.`);
  } else {
    editorialNotes.push(`Pronounced boxy drop shoulder (+${bestShoulderDelta.toFixed(1)}cm) for exaggerated high-fashion silhouette.`);
  }

  editorialNotes.push(`Chest circumference provides ${bestChestDelta.toFixed(1)}cm positive ease over biological thoracic profile.`);

  if (bestLengthDelta > 8) {
    editorialNotes.push(`Hemline drops cleanly below the iliac crest for balanced vertical proportion (+${bestLengthDelta.toFixed(1)}cm relative drop).`);
  } else {
    editorialNotes.push(`Hemline finishes flush with natural waistline for an architectural crop.`);
  }

  const matchScore = Math.max(72, Math.min(99, Math.round(100 - minDiff * 2.2)));

  return {
    recommendedSize: bestSize,
    alternativeSize,
    silhouetteStyle: preference,
    matchScore,
    shoulderDeltaCm: Number(bestShoulderDelta.toFixed(1)),
    chestDeltaCm: Number(bestChestDelta.toFixed(1)),
    lengthDeltaCm: Number(bestLengthDelta.toFixed(1)),
    status,
    editorialNotes
  };
}

export function getEquivalentEuSize(alpha: string): number {
  const match = LUXURY_SIZE_STANDARDS.find(s => s.alpha === alpha);
  return match ? match.eu : 48;
}

export function getEquivalentUsSize(alpha: string): number {
  const match = LUXURY_SIZE_STANDARDS.find(s => s.alpha === alpha);
  return match ? match.usUk : 38;
}
