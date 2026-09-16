import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { LandmarkPoint, PoseKeypoints, BodyDimensions } from './types';

export class PoseDetectionEngine {
  private landmarker: PoseLandmarker | null = null;
  private isInitializing: boolean = false;
  private initError: string | null = null;
  private lastVideoTime: number = -1;
  private calibrationRatio: number = 1.0; // User adjustable scale factor
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
    confidence: 0.95
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

  /**
   * Detects pose landmarks from an HTMLVideoElement in real time
   */
  public detect(video: HTMLVideoElement, timestampMs: number): {
    keypoints: PoseKeypoints | null;
    dimensions: BodyDimensions;
  } {
    if (!this.landmarker || video.readyState < 2) {
      return { keypoints: null, dimensions: this.smoothedDimensions };
    }

    if (video.currentTime === this.lastVideoTime) {
      return { keypoints: null, dimensions: this.smoothedDimensions };
    }
    this.lastVideoTime = video.currentTime;

    try {
      const result = this.landmarker.detectForVideo(video, timestampMs);
      if (!result || !result.landmarks || result.landmarks.length === 0) {
        return { keypoints: null, dimensions: this.smoothedDimensions };
      }

      const rawLandmarks = result.landmarks[0];
      const keypoints = this.extractKeypoints(rawLandmarks);
      const dimensions = this.computeDimensions(keypoints, video.videoWidth, video.videoHeight);

      return { keypoints, dimensions };
    } catch (err) {
      console.error('Error during pose detection:', err);
      return { keypoints: null, dimensions: this.smoothedDimensions };
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

    const neckBase: LandmarkPoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
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
      confidence: 0.98
    };

    return { keypoints, dimensions: dims };
  }

  private extractKeypoints(landmarks: any[]): PoseKeypoints {
    const p = (idx: number): LandmarkPoint => {
      const lm = landmarks[idx] || { x: 0.5, y: 0.5, z: 0, visibility: 0 };
      return { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
    };

    const nose = p(0);
    const leftEye = p(2);
    const rightEye = p(5);
    const leftEar = p(7);
    const rightEar = p(8);
    const leftShoulder = p(11);
    const rightShoulder = p(12);
    const leftElbow = p(13);
    const rightElbow = p(14);
    const leftWrist = p(15);
    const rightWrist = p(16);
    const leftHip = p(23);
    const rightHip = p(24);

    const neckBase: LandmarkPoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
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
      z: (neckBase.z || 0) * 0.65 + (midHip.z || 0) * 0.35
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
      leftEye,
      rightEye,
      leftEar,
      rightEar,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      neckBase,
      midHip,
      chestMid,
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
      confidence: kp.confidence
    };

    return this.smoothedDimensions;
  }
}

export const poseEngine = new PoseDetectionEngine();
