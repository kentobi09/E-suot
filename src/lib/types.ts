export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseKeypoints {
  nose?: LandmarkPoint;
  leftEyeInner?: LandmarkPoint;
  leftEye?: LandmarkPoint;
  leftEyeOuter?: LandmarkPoint;
  rightEyeInner?: LandmarkPoint;
  rightEye?: LandmarkPoint;
  rightEyeOuter?: LandmarkPoint;
  leftEar?: LandmarkPoint;
  rightEar?: LandmarkPoint;
  mouthLeft?: LandmarkPoint;
  mouthRight?: LandmarkPoint;
  leftShoulder: LandmarkPoint;
  rightShoulder: LandmarkPoint;
  leftElbow?: LandmarkPoint;
  rightElbow?: LandmarkPoint;
  leftWrist?: LandmarkPoint;
  rightWrist?: LandmarkPoint;
  leftPinky?: LandmarkPoint;
  rightPinky?: LandmarkPoint;
  leftIndex?: LandmarkPoint;
  rightIndex?: LandmarkPoint;
  leftThumb?: LandmarkPoint;
  rightThumb?: LandmarkPoint;
  leftHip: LandmarkPoint;
  rightHip: LandmarkPoint;
  leftKnee?: LandmarkPoint;
  rightKnee?: LandmarkPoint;
  leftAnkle?: LandmarkPoint;
  rightAnkle?: LandmarkPoint;
  leftHeel?: LandmarkPoint;
  rightHeel?: LandmarkPoint;
  leftFootIndex?: LandmarkPoint;
  rightFootIndex?: LandmarkPoint;
  
  // Computed body landmarks
  neckBase: LandmarkPoint;
  midHip: LandmarkPoint;
  chestMid: LandmarkPoint;
  spineMid?: LandmarkPoint;

  // Complete array of all 33 detected landmarks in standard MediaPipe ordering
  allLandmarks?: LandmarkPoint[];
  
  // Geometric metrics in normalized [0, 1] screen space
  shoulderWidthNorm: number;
  torsoHeightNorm: number;
  shoulderSlopeRad: number;
  torsoAngleRad: number;
  bodyRotationY: number; // yaw approximation
  confidence: number;

  // Real-world 3D metric landmarks (in meters) from MediaPipe
  worldLandmarks?: { x: number; y: number; z: number; visibility?: number }[];
  // Binary / alpha segmentation mask of user silhouette for depth occlusion
  segmentationMask?: ImageBitmap | HTMLCanvasElement | null;
}

export interface EnvironmentalLighting {
  luminance: number; // 0.0 (dark) to 1.0 (bright)
  r: number;         // Normalized red chromaticity [0, 1]
  g: number;         // Normalized green chromaticity [0, 1]
  b: number;         // Normalized blue chromaticity [0, 1]
}

export type ScanPhase = 'scanning' | 'locked';

export interface BodyDimensions {
  shoulderWidthCm: number;
  torsoLengthCm: number;
  chestCircumferenceCm: number;
  shoulderWidthIn: number;
  torsoLengthIn: number;
  chestCircumferenceIn: number;
  distanceEstimateM: number;
  alignmentScore: number;
  isAligned: boolean;
  confidence: number;
  scanPhase: ScanPhase;
  stabilityProgress: number; // 0 to 100%
}

export interface GarmentSizeSpec {
  chestCm: number;
  shoulderCm: number;
  lengthCm: number;
}

export interface GarmentItem {
  id: string;
  name: string;
  category: string;
  editorialCode: string;
  brand: string;
  colorName: string;
  hex: string;
  description: string;
  fabricSpec: string;
  silhouette: 'Tailored' | 'Regular' | 'Boxy / Dropped' | 'Relaxed';
  imageUrl: string;
  aspectRatio: number; // width / height
  anchorPointRatio: { x: number; y: number }; // Relative collar center [0.5, 0.12]
  shoulderSpanRatio?: number; // Fraction of image width between shoulder seams (e.g. 0.64)
  scaleFactor: number;
  offsetYFactor: number;
  sizeChart: Record<string, GarmentSizeSpec>;
  availableSizes: string[];
  defaultSize: string;
}

export type FitEngineMode = 'quick' | 'mesh';

export interface GarmentRenderOptions {
  opacity: number; // 0.0 to 1.0
  wireframeOnly: boolean;
  sizeMultiplier: number; // 0.9 (S) to 1.15 (XXL)
  fitEngine: FitEngineMode;
  showLandmarks: boolean;
  environmentalLighting?: EnvironmentalLighting;
}

export type SilhouettePreference = 'tailored' | 'regular' | 'oversized';

export interface FitRecommendation {
  recommendedSize: string;
  alternativeSize?: string;
  silhouetteStyle: SilhouettePreference;
  matchScore: number; // 0-100
  shoulderDeltaCm: number;
  chestDeltaCm: number;
  lengthDeltaCm: number;
  status: 'Snug' | 'True Fit' | 'Generous' | 'Oversized';
  editorialNotes: string[];
}

export interface SnapshotData {
  dataUrl: string;
  timestamp: string;
  dimensions: BodyDimensions;
  garment: GarmentItem;
  size: string;
  fitEngine: FitEngineMode;
}
