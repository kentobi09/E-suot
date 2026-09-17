import { FilesetResolver, PoseLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { LandmarkPoint, PoseKeypoints, BodyDimensions } from './types';

export class PoseDetectionEngine {
  private landmarker: PoseLandmarker | null = null;
  private segmenter: ImageSegmenter | null = null;
  private isInitializing: boolean = false;
  private initError: string | null = null;
  private lastVideoTime: number = -1;
  private calibrationRatio: number = 1.0; // User adjustable scale factor

  // Real-time silhouette segmentation buffer for depth occlusion
  private lastSegmentationMask: HTMLCanvasElement | null = null;
  private segmentCanvas: HTMLCanvasElement | null = null;
  private segmentCtx: CanvasRenderingContext2D | null = null;
  private segmentFrameCounter: number = 0;

  private smoothedDimensions: BodyDimensions = {
    shoulderWidthCm: 46.0,
    torsoLengthCm: 62.0,
    chestCircumferenceCm: 102.0,
    shoulderWidthIn: 18.1,
    torsoLengthIn: 24.4,
    chestCircumferenceIn: 40.2,
    distanceEstimateM: 1.8,
    alignmentScore: 92,
    isAligned: true,
    confidence: 0.95,
    scanPhase: 'scanning',
    stabilityProgress: 0
  };

  public async initialize(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load WebAssembly binaries from Google MediaPipe CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Initialize lightweight real-time selfie segmentation for depth buffer occlusion
      try {
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        });
      } catch (segErr) {
        console.warn('ImageSegmenter GPU init fallback:', segErr);
      }

      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.warn('MediaPipe Vision GPU initialization failed, attempting CPU fallback:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });
        this.isInitializing = false;
        return true;
      } catch (fallbackErr: any) {
        this.initError = fallbackErr.message || 'Failed to initialize MediaPipe Pose Landmarker';
        this.isInitializing = false;
        return false;
      }
    }
  }

  public getStatus() {
    return {
      isReady: !!this.landmarker,
      isInitializing: this.isInitializing,
      error: this.initError
    };
  }

  public setCalibrationRatio(ratio: number) {
    this.calibrationRatio = Math.max(0.7, Math.min(1.3, ratio));
  }

  public getCalibrationRatio(): number {
    return this.calibrationRatio;
  }

  private lastDetectedKeypoints: PoseKeypoints | null = null;
  private missedFramesCount: number = 0;

  public detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, timestampMs: number): {
    keypoints: PoseKeypoints | null;
    dimensions: BodyDimensions;
  } {
    if (!this.landmarker) {
      return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
    }

    let width = 0;
    let height = 0;

    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2) {
        return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
      }
      // If video timestamp has not advanced (e.g. 60Hz RAF with 30Hz camera feed),
      // persist the last detected keypoints to avoid 30Hz blinking/strobing!
      if (source.currentTime === this.lastVideoTime) {
        return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
      }
      this.lastVideoTime = source.currentTime;
      width = source.videoWidth;
      height = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      if (!source.complete || !source.naturalWidth) {
        return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
      }
      width = source.naturalWidth;
      height = source.naturalHeight;
    } else if (source instanceof HTMLCanvasElement) {
      width = source.width;
      height = source.height;
    }

    if (width === 0 || height === 0) {
      return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
    }

    try {
      const result = this.landmarker.detectForVideo(source as any, timestampMs);
      if (!result || !result.landmarks || result.landmarks.length === 0) {
        this.missedFramesCount++;
        // Keep persisting for up to 15 dropped frames (~0.5s) to eliminate flickering
        if (this.missedFramesCount > 15) {
          this.lastDetectedKeypoints = null;
        }
        return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
      }

      this.missedFramesCount = 0;
      const rawLandmarks = result.landmarks[0];
      const keypoints = this.extractKeypoints(rawLandmarks);

      // Attach 3D metric worldLandmarks for SkinnedMesh rigging
      if (result.worldLandmarks && result.worldLandmarks.length > 0) {
        keypoints.worldLandmarks = result.worldLandmarks[0];
      }

      // Execute real-time silhouette segmentation (every 2nd frame for 60fps budget)
      this.segmentFrameCounter++;
      if (this.segmenter && this.segmentFrameCounter % 2 === 0 && (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement)) {
        try {
          this.segmenter.segmentForVideo(source as any, timestampMs, (segResult) => {
            if (segResult && segResult.categoryMask) {
              const mask = segResult.categoryMask;
              const mW = mask.width;
              const mH = mask.height;

              if (!this.segmentCanvas) {
                this.segmentCanvas = document.createElement('canvas');
              }
              if (this.segmentCanvas.width !== mW || this.segmentCanvas.height !== mH) {
                this.segmentCanvas.width = mW;
                this.segmentCanvas.height = mH;
                this.segmentCtx = this.segmentCanvas.getContext('2d', { willReadFrequently: true });
              }

              if (this.segmentCtx) {
                const maskBytes = mask.getAsUint8Array();
                const imgData = this.segmentCtx.createImageData(mW, mH);
                const out = imgData.data;
                for (let i = 0; i < maskBytes.length; i++) {
                  const isUser = maskBytes[i] > 0;
                  const idx = i * 4;
                  out[idx] = 255;
                  out[idx + 1] = 255;
                  out[idx + 2] = 255;
                  out[idx + 3] = isUser ? 255 : 0;
                }
                this.segmentCtx.putImageData(imgData, 0, 0);
                this.lastSegmentationMask = this.segmentCanvas;
              }
            }
          });
        } catch {
          // Graceful fallback
        }
      }

      if (this.lastSegmentationMask) {
        keypoints.segmentationMask = this.lastSegmentationMask;
      }

      const dimensions = this.computeDimensions(keypoints, width, height);

      this.lastDetectedKeypoints = keypoints;
      return { keypoints, dimensions };
    } catch (err) {
      console.error('Error during pose detection:', err);
      return { keypoints: this.lastDetectedKeypoints, dimensions: this.smoothedDimensions };
    }
  }

  /**
   * Generates a synthetic pose for studio mannequin / test mode
   */
  public getSyntheticPose(timeSeconds: number): {
    keypoints: PoseKeypoints;
    dimensions: BodyDimensions;
  } {
    // Subtle breathing and swaying frequency
    const swayX = Math.sin(timeSeconds * 0.8) * 0.008;
    const breatheY = Math.sin(timeSeconds * 1.5) * 0.004;

    const leftShoulder: LandmarkPoint = { x: 0.38 + swayX, y: 0.28 + breatheY, z: -0.05, visibility: 0.99 };
    const rightShoulder: LandmarkPoint = { x: 0.62 + swayX, y: 0.28 - breatheY * 0.5, z: 0.05, visibility: 0.99 };
    const leftHip: LandmarkPoint = { x: 0.41 + swayX * 0.5, y: 0.66, z: -0.02, visibility: 0.98 };
    const rightHip: LandmarkPoint = { x: 0.59 + swayX * 0.5, y: 0.66, z: 0.02, visibility: 0.98 };

    const shMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const neckBase: LandmarkPoint = {
      x: shMidX,
      y: shMidY - 0.03,
      z: 0
    };
    const midHip: LandmarkPoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: 0
    };
    const chestMid: LandmarkPoint = {
      x: neckBase.x * 0.65 + midHip.x * 0.35,
      y: neckBase.y * 0.65 + midHip.y * 0.35,
      z: 0
    };

    const dx = rightShoulder.x - leftShoulder.x;
    const dy = rightShoulder.y - leftShoulder.y;
    const shoulderWidthNorm = Math.sqrt(dx * dx + dy * dy);
    const torsoHeightNorm = Math.hypot(midHip.x - neckBase.x, midHip.y - neckBase.y);
    const shoulderSlopeRad = Math.atan2(dy, dx);
    const torsoAngleRad = Math.atan2(midHip.y - neckBase.y, midHip.x - neckBase.x);

    const keypoints: PoseKeypoints = {
      nose: { x: 0.50 + swayX, y: 0.16 + breatheY, z: 0, visibility: 0.99 },
      leftEye: { x: 0.48 + swayX, y: 0.15 + breatheY, z: 0, visibility: 0.99 },
      rightEye: { x: 0.52 + swayX, y: 0.15 + breatheY, z: 0, visibility: 0.99 },
      leftShoulder,
      rightShoulder,
      leftElbow: { x: 0.33 + swayX, y: 0.45, z: 0, visibility: 0.95 },
      rightElbow: { x: 0.67 + swayX, y: 0.45, z: 0, visibility: 0.95 },
      leftWrist: { x: 0.30 + swayX, y: 0.62, z: 0, visibility: 0.95 },
      rightWrist: { x: 0.70 + swayX, y: 0.62, z: 0, visibility: 0.95 },
      leftHip,
      rightHip,
      leftKnee: { x: 0.42 + swayX * 0.4, y: 0.82, z: -0.01, visibility: 0.95 },
      rightKnee: { x: 0.58 + swayX * 0.4, y: 0.82, z: 0.01, visibility: 0.95 },
      leftAnkle: { x: 0.43 + swayX * 0.3, y: 0.96, z: 0, visibility: 0.92 },
      rightAnkle: { x: 0.57 + swayX * 0.3, y: 0.96, z: 0, visibility: 0.92 },
      neckBase,
      midHip,
      chestMid,
      shoulderWidthNorm,
      torsoHeightNorm,
      shoulderSlopeRad,
      torsoAngleRad,
      bodyRotationY: 0.04 * Math.sin(timeSeconds * 0.5),
      confidence: 0.98
    };

    const dims: BodyDimensions = {
      shoulderWidthCm: Number((46.2 + Math.sin(timeSeconds * 0.5) * 0.3).toFixed(1)),
      torsoLengthCm: Number((62.5 + Math.sin(timeSeconds * 1.5) * 0.2).toFixed(1)),
      chestCircumferenceCm: Number((102.4 + Math.sin(timeSeconds * 1.5) * 0.4).toFixed(1)),
      shoulderWidthIn: 18.2,
      torsoLengthIn: 24.6,
      chestCircumferenceIn: 40.3,
      distanceEstimateM: 1.8,
      alignmentScore: 96,
      isAligned: true,
      confidence: 0.98,
      scanPhase: 'locked',
      stabilityProgress: 100
    };

    return { keypoints, dimensions: dims };
  }

  private extractKeypoints(landmarks: any[]): PoseKeypoints {
    const p = (idx: number): LandmarkPoint => {
      const lm = landmarks[idx] || { x: 0.5, y: 0.5, z: 0, visibility: 0 };
      return { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
    };

    const nose = p(0);
    const leftEyeInner = p(1);
    const leftEye = p(2);
    const leftEyeOuter = p(3);
    const rightEyeInner = p(4);
    const rightEye = p(5);
    const rightEyeOuter = p(6);
    const leftEar = p(7);
    const rightEar = p(8);
    const mouthLeft = p(9);
    const mouthRight = p(10);
    const leftShoulder = p(11);
    const rightShoulder = p(12);
    const leftElbow = p(13);
    const rightElbow = p(14);
    const leftWrist = p(15);
    const rightWrist = p(16);
    const leftPinky = p(17);
    const rightPinky = p(18);
    const leftIndex = p(19);
    const rightIndex = p(20);
    const leftThumb = p(21);
    const rightThumb = p(22);
    const leftHip = p(23);
    const rightHip = p(24);
    const leftKnee = p(25);
    const rightKnee = p(26);
    const leftAnkle = p(27);
    const rightAnkle = p(28);
    const leftHeel = p(29);
    const rightHeel = p(30);
    const leftFootIndex = p(31);
    const rightFootIndex = p(32);

    const allLandmarks: LandmarkPoint[] = [];
    for (let i = 0; i <= 32; i++) {
      allLandmarks.push(p(i));
    }

    const shMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shMidY = (leftShoulder.y + rightShoulder.y) / 2;
    
    // Suprasternal notch elevation above biacromial shoulder line
    const neckLift = (nose.visibility && nose.visibility > 0.35 && nose.y < shMidY)
      ? (shMidY - nose.y) * 0.22
      : 0.035;

    const neckBase: LandmarkPoint = {
      x: shMidX,
      y: shMidY - neckLift,
      z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2,
      visibility: Math.min(leftShoulder.visibility || 0.5, rightShoulder.visibility || 0.5)
    };

    const midHip: LandmarkPoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2,
      visibility: Math.min(leftHip.visibility || 0.5, rightHip.visibility || 0.5)
    };

    const chestMid: LandmarkPoint = {
      x: neckBase.x * 0.65 + midHip.x * 0.35,
      y: neckBase.y * 0.65 + midHip.y * 0.35,
      z: (neckBase.z || 0) * 0.65 + (midHip.z || 0) * 0.35,
      visibility: Math.min(neckBase.visibility || 0.5, midHip.visibility || 0.5)
    };

    const spineMid: LandmarkPoint = {
      x: neckBase.x * 0.35 + midHip.x * 0.65,
      y: neckBase.y * 0.35 + midHip.y * 0.65,
      z: (neckBase.z || 0) * 0.35 + (midHip.z || 0) * 0.65,
      visibility: Math.min(neckBase.visibility || 0.5, midHip.visibility || 0.5)
    };

    const dx = rightShoulder.x - leftShoulder.x;
    const dy = rightShoulder.y - leftShoulder.y;
    const shoulderWidthNorm = Math.hypot(dx, dy);
    const torsoHeightNorm = Math.hypot(midHip.x - neckBase.x, midHip.y - neckBase.y);
    const shoulderSlopeRad = Math.atan2(dy, dx);
    const torsoAngleRad = Math.atan2(midHip.y - neckBase.y, midHip.x - neckBase.x);

    // Approximate body yaw rotation from z-depth or shoulder x asymmetry
    const bodyRotationY = (rightShoulder.z || 0) - (leftShoulder.z || 0);

    const confidence = Math.min(
      leftShoulder.visibility || 0.8,
      rightShoulder.visibility || 0.8,
      leftHip.visibility || 0.8,
      rightHip.visibility || 0.8
    );

    return {
      nose,
      leftEyeInner,
      leftEye,
      leftEyeOuter,
      rightEyeInner,
      rightEye,
      rightEyeOuter,
      leftEar,
      rightEar,
      mouthLeft,
      mouthRight,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftPinky,
      rightPinky,
      leftIndex,
      rightIndex,
      leftThumb,
      rightThumb,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
      leftHeel,
      rightHeel,
      leftFootIndex,
      rightFootIndex,
      neckBase,
      midHip,
      chestMid,
      spineMid,
      allLandmarks,
      shoulderWidthNorm,
      torsoHeightNorm,
      shoulderSlopeRad,
      torsoAngleRad,
      bodyRotationY,
      confidence
    };
  }

  private computeDimensions(
    kp: PoseKeypoints,
    videoWidth: number,
    videoHeight: number
  ): BodyDimensions {
    // Inter-pupillary distance (IPD) baseline: ~6.3 cm in adult human anatomy
    let cmPerPixel = 0.15; // default fallback
    let distanceEstimateM = 1.8;

    if (kp.leftEye && kp.rightEye && kp.leftEye.visibility! > 0.5 && kp.rightEye.visibility! > 0.5) {
      const ipdNorm = Math.hypot(kp.rightEye.x - kp.leftEye.x, (kp.rightEye.y - kp.leftEye.y) * (videoHeight / videoWidth));
      const ipdPixels = ipdNorm * videoWidth;
      if (ipdPixels > 10) {
        // Average IPD = 6.3 cm
        cmPerPixel = (6.3 / ipdPixels) * this.calibrationRatio;
        // Standard focal length approximation (f ~ 650px on standard 720p webcam)
        distanceEstimateM = Math.max(0.8, Math.min(3.5, (650 * 0.063) / ipdPixels));
      }
    } else {
      // Fallback scale based on biacromial diameter ratio
      const shoulderPixelSpan = kp.shoulderWidthNorm * videoWidth;
      if (shoulderPixelSpan > 40) {
        cmPerPixel = (46.0 / shoulderPixelSpan) * this.calibrationRatio;
        distanceEstimateM = Math.max(1.0, Math.min(3.0, (650 * 0.46) / shoulderPixelSpan));
      }
    }

    const shoulderPixels = kp.shoulderWidthNorm * videoWidth;
    const torsoPixels = kp.torsoHeightNorm * videoHeight;

    const rawShoulderWidthCm = shoulderPixels * cmPerPixel;
    const rawTorsoLengthCm = torsoPixels * cmPerPixel;
    
    // Anthropometric chest circumference estimate:
    // Bi-lateral chest breadth is roughly 0.88x shoulder breadth, and depth is ~0.65x breadth.
    // Ellipse perimeter Ramanujan approximation: P ~ pi * (3(a+b) - sqrt((3a+b)*(a+3b)))
    const a = (rawShoulderWidthCm * 0.86) / 2; // semi-major axis (width radius)
    const b = (rawShoulderWidthCm * 0.60) / 2; // semi-minor axis (chest depth radius)
    const rawChestCircumferenceCm = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

    // Clamped realistic human ranges
    const shoulderWidthCm = Math.max(34, Math.min(62, rawShoulderWidthCm));
    const torsoLengthCm = Math.max(45, Math.min(85, rawTorsoLengthCm));
    const chestCircumferenceCm = Math.max(76, Math.min(136, rawChestCircumferenceCm));

    // Alignment checking: User should be centered and shoulders between 30% and 75% width
    const centerX = kp.neckBase.x;
    const isCentered = centerX >= 0.40 && centerX <= 0.60;
    const isGoodDistance = kp.shoulderWidthNorm >= 0.20 && kp.shoulderWidthNorm <= 0.46;
    const isUpright = Math.abs(kp.shoulderSlopeRad) < 0.25;

    let alignmentScore = 40;
    if (isCentered) alignmentScore += 25;
    if (isGoodDistance) alignmentScore += 25;
    if (isUpright) alignmentScore += 10;
    const isAligned = alignmentScore >= 75;

    // Exponential smoothing (alpha = 0.20) for smooth tabular readouts
    const alpha = 0.20;
    const smooth = (curr: number, prev: number) => prev + alpha * (curr - prev);

    this.smoothedDimensions = {
      shoulderWidthCm: Number(smooth(shoulderWidthCm, this.smoothedDimensions.shoulderWidthCm).toFixed(1)),
      torsoLengthCm: Number(smooth(torsoLengthCm, this.smoothedDimensions.torsoLengthCm).toFixed(1)),
      chestCircumferenceCm: Number(smooth(chestCircumferenceCm, this.smoothedDimensions.chestCircumferenceCm).toFixed(1)),
      shoulderWidthIn: Number((smooth(shoulderWidthCm, this.smoothedDimensions.shoulderWidthCm) / 2.54).toFixed(1)),
      torsoLengthIn: Number((smooth(torsoLengthCm, this.smoothedDimensions.torsoLengthCm) / 2.54).toFixed(1)),
      chestCircumferenceIn: Number((smooth(chestCircumferenceCm, this.smoothedDimensions.chestCircumferenceCm) / 2.54).toFixed(1)),
      distanceEstimateM: Number(smooth(distanceEstimateM, this.smoothedDimensions.distanceEstimateM).toFixed(2)),
      alignmentScore,
      isAligned,
      confidence: kp.confidence,
      scanPhase: this.smoothedDimensions.scanPhase || 'scanning',
      stabilityProgress: this.smoothedDimensions.stabilityProgress || 0
    };

    return this.smoothedDimensions;
  }
}

export const poseEngine = new PoseDetectionEngine();
