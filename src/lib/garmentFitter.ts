import { PoseKeypoints, GarmentItem, FitEngineMode, GarmentRenderOptions, LandmarkPoint } from './types';

export type { GarmentRenderOptions };

export class GarmentFitter {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private processedImageCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Preloads an image into memory
   */
  public async preloadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  /**
   * Client-side background removal & edge feathering for custom garment uploads
   */
  public processBackgroundRemoval(
    sourceImg: HTMLImageElement,
    threshold: number = 35, // Color distance tolerance
    feather: boolean = true
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImg.naturalWidth || sourceImg.width || 500;
    canvas.height = sourceImg.naturalHeight || sourceImg.height || 600;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Sample the corner pixels to determine background tone (top-left, top-right)
    const bgR = (data[0] + data[(canvas.width - 1) * 4]) / 2;
    const bgG = (data[1] + data[(canvas.width - 1) * 4 + 1]) / 2;
    const bgB = (data[2] + data[(canvas.width - 1) * 4 + 2]) / 2;

    const thresholdSq = threshold * threshold * 3;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const distSq = (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2;

      if (distSq < thresholdSq) {
        // Transparent
        data[i + 3] = 0;
      } else if (feather && distSq < thresholdSq * 1.5) {
        // Soft edge feathering
        const factor = (distSq - thresholdSq) / (thresholdSq * 0.5);
        data[i + 3] = Math.floor(data[i + 3] * factor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Main overlay render call onto the camera canvas
   */
  public renderGarment(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    keypoints: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ) {
    if (!keypoints || !imageSource) return;

    ctx.save();
    ctx.globalAlpha = options.opacity;

    if (options.fitEngine === 'quick') {
      this.renderQuickAffine(ctx, canvasWidth, canvasHeight, keypoints, garment, imageSource, options);
    } else {
      this.renderAdaptiveMesh(ctx, canvasWidth, canvasHeight, keypoints, garment, imageSource, options);
    }

    ctx.restore();

    // Optionally render skeletal alignment guidelines and landmarks
    if (options.showLandmarks) {
      this.renderLandmarkSkeleton(ctx, canvasWidth, canvasHeight, keypoints);
    }
  }

  /**
   * Mode 1: Quick Fit (2D Affine transform scaling & rotating to shoulders)
   */
  /**
   * Mode 1: Quick Fit (2D Affine transform scaling & rotating to shoulders)
   */
  private renderQuickAffine(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ) {
    // Determine screen-left and screen-right shoulders to guarantee dx >= 0
    const shLeft = kp.leftShoulder.x <= kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;
    const shRight = kp.leftShoulder.x > kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;

    const shLeftX = shLeft.x * canvasWidth;
    const shLeftY = shLeft.y * canvasHeight;
    const shRightX = shRight.x * canvasWidth;
    const shRightY = shRight.y * canvasHeight;

    const dx = shRightX - shLeftX;
    const dy = shRightY - shLeftY;
    const shoulderSpan = Math.hypot(dx, dy);

    // Natural shoulder line tilt (guaranteed in [-35deg, +35deg] to prevent unnatural flipping)
    const rawAngle = Math.atan2(dy, dx);
    const maxTilt = (35 * Math.PI) / 180;
    const angle = Math.max(-maxTilt, Math.min(maxTilt, rawAngle));

    const shMidX = (shLeftX + shRightX) / 2;
    const shMidY = (shLeftY + shRightY) / 2;

    // Upward perpendicular unit vector from shoulder line towards head
    const upX = Math.sin(angle);
    const upY = -Math.cos(angle);

    // Anatomical suprasternal notch collar elevation above shoulder midpoint
    const neckElev = shoulderSpan * 0.08;
    const collarX = shMidX + upX * neckElev;
    const collarY = shMidY + upY * neckElev + (garment.offsetYFactor || 0) * canvasHeight;

    // Garment dimensions based on physical shoulder-to-shoulder seam ratio
    const shoulderRatio = garment.shoulderSpanRatio || 0.68;
    const garmentWidth = (shoulderSpan / shoulderRatio) * (garment.scaleFactor || 1.0) * options.sizeMultiplier;

    // Anatomical torso distance from suprasternal notch to mid-hip line
    const neckToHipSpan = Math.hypot(
      (kp.midHip.x - kp.neckBase.x) * canvasWidth,
      (kp.midHip.y - kp.neckBase.y) * canvasHeight
    );
    const baseAspectHeight = garmentWidth / garment.aspectRatio;
    const anatomicalTorsoHeight = neckToHipSpan * 1.25 * options.sizeMultiplier;
    const garmentHeight = Math.max(baseAspectHeight, anatomicalTorsoHeight);

    const anchorRelX = garment.anchorPointRatio.x;
    const anchorRelY = garment.anchorPointRatio.y;

    ctx.save();
    ctx.translate(collarX, collarY);
    ctx.rotate(angle);

    if (options.wireframeOnly) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        -garmentWidth * anchorRelX,
        -garmentHeight * anchorRelY,
        garmentWidth,
        garmentHeight
      );
      // Diagonal cross to signify wireframe
      ctx.beginPath();
      ctx.moveTo(-garmentWidth * anchorRelX, -garmentHeight * anchorRelY);
      ctx.lineTo(garmentWidth * (1 - anchorRelX), garmentHeight * (1 - anchorRelY));
      ctx.stroke();
    } else {
      ctx.drawImage(
        imageSource,
        -garmentWidth * anchorRelX,
        -garmentHeight * anchorRelY,
        garmentWidth,
        garmentHeight
      );
    }

    ctx.restore();
  }

  /**
   * Mode 2: Adaptive Mesh (Piecewise deformation curved to shoulders, spine and yaw)
   */
  private renderAdaptiveMesh(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ) {
    const slices = 8;

    // Determine screen-left and screen-right shoulders to guarantee dx >= 0
    const shLeft = kp.leftShoulder.x <= kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;
    const shRight = kp.leftShoulder.x > kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;

    const shLeftX = shLeft.x * canvasWidth;
    const shLeftY = shLeft.y * canvasHeight;
    const shRightX = shRight.x * canvasWidth;
    const shRightY = shRight.y * canvasHeight;

    const dx = shRightX - shLeftX;
    const dy = shRightY - shLeftY;
    const shoulderSpan = Math.hypot(dx, dy);

    // Natural shoulder line tilt (guaranteed in [-35deg, +35deg] to prevent unnatural flipping)
    const rawAngle = Math.atan2(dy, dx);
    const maxTilt = (35 * Math.PI) / 180;
    const angle = Math.max(-maxTilt, Math.min(maxTilt, rawAngle));

    const shMidX = (shLeftX + shRightX) / 2;
    const shMidY = (shLeftY + shRightY) / 2;

    // Upward perpendicular unit vector from shoulder line towards head
    const upX = Math.sin(angle);
    const upY = -Math.cos(angle);

    // Anatomical suprasternal notch collar elevation above shoulder midpoint
    const neckElev = shoulderSpan * 0.08;
    const collarX = shMidX + upX * neckElev;
    const collarY = shMidY + upY * neckElev + (garment.offsetYFactor || 0) * canvasHeight;

    // Garment dimensions based on physical shoulder-to-shoulder seam ratio
    const shoulderRatio = garment.shoulderSpanRatio || 0.68;
    const garmentWidth = (shoulderSpan / shoulderRatio) * (garment.scaleFactor || 1.0) * options.sizeMultiplier;

    // Anatomical torso distance from suprasternal notch to mid-hip line
    const neckToHipSpan = Math.hypot(
      (kp.midHip.x - kp.neckBase.x) * canvasWidth,
      (kp.midHip.y - kp.neckBase.y) * canvasHeight
    );
    const baseAspectHeight = garmentWidth / garment.aspectRatio;
    const anatomicalTorsoHeight = neckToHipSpan * 1.25 * options.sizeMultiplier;
    const garmentHeight = Math.max(baseAspectHeight, anatomicalTorsoHeight);

    const sourceW = (imageSource as HTMLImageElement).naturalWidth || imageSource.width;
    const sourceH = (imageSource as HTMLImageElement).naturalHeight || imageSource.height;

    // Anchor center
    ctx.save();
    ctx.translate(collarX, collarY);
    ctx.rotate(angle);

    const startX = -garmentWidth * garment.anchorPointRatio.x;
    const startY = -garmentHeight * garment.anchorPointRatio.y;

    const sliceW = garmentWidth / slices;
    const srcSliceW = sourceW / slices;

    for (let i = 0; i < slices; i++) {
      // Normalized horizontal position from -1 (far left sleeve) to 0 (chest center) to +1 (far right sleeve)
      const u = (i + 0.5) / slices;
      const normX = (u - 0.5) * 2;

      // Vertical shoulder slope & anatomical droop formula
      // Outer sleeves droop down slightly; chest center rises slightly
      const drapeDroop = Math.abs(normX) > 0.4 ? (Math.abs(normX) - 0.4) * (shoulderSpan * 0.18) : -4;
      
      // Yaw rotation depth compensation (closer shoulder expands, far compresses)
      const yawOffset = normX * kp.bodyRotationY * (shoulderSpan * 0.15);

      const dxSlice = startX + i * sliceW;
      const dySlice = startY + drapeDroop + yawOffset;

      if (options.wireframeOnly) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(dxSlice, dySlice, sliceW, garmentHeight);
        ctx.beginPath();
        ctx.moveTo(dxSlice, dySlice);
        ctx.lineTo(dxSlice + sliceW, dySlice + garmentHeight);
        ctx.stroke();
      } else {
        ctx.drawImage(
          imageSource,
          i * srcSliceW,
          0,
          srcSliceW,
          sourceH,
          dxSlice,
          dySlice,
          sliceW,
          garmentHeight
        );
      }
    }

    ctx.restore();
  }

  /**
   * Comprehensive Multi-Joint Skeletal Tracking Renderer
   * Renders all 33 MediaPipe anatomical joints, connecting bones, and telemetry tags
   * so the user can verify real-time body tracking precision on camera.
   */
  public renderLandmarkSkeleton(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    kp: PoseKeypoints,
    options: { showLabels?: boolean; isProminent?: boolean } = { showLabels: true, isProminent: true }
  ) {
    ctx.save();

    const p = (pt?: LandmarkPoint) => {
      if (!pt) return null;
      const vis = pt.visibility !== undefined ? pt.visibility : 1.0;
      if (vis < 0.20) return null;
      return {
        x: pt.x * w,
        y: pt.y * h,
        z: pt.z || 0,
        vis
      };
    };

    // Extract all anatomical landmark positions
    const nose = p(kp.nose);
    const leftEye = p(kp.leftEye);
    const rightEye = p(kp.rightEye);
    const leftEar = p(kp.leftEar);
    const rightEar = p(kp.rightEar);
    const mouthL = p(kp.mouthLeft);
    const mouthR = p(kp.mouthRight);

    const neck = p(kp.neckBase);
    const chest = p(kp.chestMid);
    const spine = p(kp.spineMid);
    const midHip = p(kp.midHip);

    const ls = p(kp.leftShoulder);
    const rs = p(kp.rightShoulder);
    const le = p(kp.leftElbow);
    const re = p(kp.rightElbow);
    const lw = p(kp.leftWrist);
    const rw = p(kp.rightWrist);

    const lp = p(kp.leftPinky);
    const rp = p(kp.rightPinky);
    const li = p(kp.leftIndex);
    const ri = p(kp.rightIndex);
    const lt = p(kp.leftThumb);
    const rt = p(kp.rightThumb);

    const lh = p(kp.leftHip);
    const rh = p(kp.rightHip);
    const lk = p(kp.leftKnee);
    const rk = p(kp.rightKnee);
    const la = p(kp.leftAnkle);
    const ra = p(kp.rightAnkle);
    const lheel = p(kp.leftHeel);
    const rheel = p(kp.rightHeel);
    const lfoot = p(kp.leftFootIndex);
    const rfoot = p(kp.rightFootIndex);

    // Anatomical bone connections [Joint A, Joint B, colorGroup]
    type Bone = [
      { x: number; y: number } | null,
      { x: number; y: number } | null,
      string
    ];

    const bones: Bone[] = [
      // Head & Facial contours
      [leftEar, leftEye, 'rgba(56, 189, 248, 0.45)'],
      [leftEye, nose, 'rgba(56, 189, 248, 0.55)'],
      [nose, rightEye, 'rgba(56, 189, 248, 0.55)'],
      [rightEye, rightEar, 'rgba(56, 189, 248, 0.45)'],
      [mouthL, mouthR, 'rgba(56, 189, 248, 0.35)'],
      [nose, neck, 'rgba(6, 182, 212, 0.55)'],

      // Torso & Clavicles
      [ls, neck, 'rgba(6, 182, 212, 0.75)'],
      [neck, rs, 'rgba(6, 182, 212, 0.75)'],
      [ls, rs, 'rgba(245, 245, 247, 0.35)'],
      [neck, chest, 'rgba(6, 182, 212, 0.85)'],
      [chest, spine, 'rgba(6, 182, 212, 0.85)'],
      [spine, midHip, 'rgba(6, 182, 212, 0.85)'],
      [chest, ls, 'rgba(6, 182, 212, 0.30)'],
      [chest, rs, 'rgba(6, 182, 212, 0.30)'],
      [ls, lh, 'rgba(14, 165, 233, 0.40)'],
      [rs, rh, 'rgba(14, 165, 233, 0.40)'],
      [lh, midHip, 'rgba(168, 85, 247, 0.75)'],
      [midHip, rh, 'rgba(168, 85, 247, 0.75)'],

      // Left Arm & Hand
      [ls, le, 'rgba(16, 185, 129, 0.80)'],
      [le, lw, 'rgba(16, 185, 129, 0.80)'],
      [lw, lt, 'rgba(52, 211, 153, 0.60)'],
      [lw, li, 'rgba(52, 211, 153, 0.60)'],
      [lw, lp, 'rgba(52, 211, 153, 0.60)'],
      [lp, li, 'rgba(52, 211, 153, 0.35)'],

      // Right Arm & Hand
      [rs, re, 'rgba(16, 185, 129, 0.80)'],
      [re, rw, 'rgba(16, 185, 129, 0.80)'],
      [rw, rt, 'rgba(52, 211, 153, 0.60)'],
      [rw, ri, 'rgba(52, 211, 153, 0.60)'],
      [rw, rp, 'rgba(52, 211, 153, 0.60)'],
      [rp, ri, 'rgba(52, 211, 153, 0.35)'],

      // Left Leg & Foot
      [lh, lk, 'rgba(245, 158, 11, 0.75)'],
      [lk, la, 'rgba(245, 158, 11, 0.75)'],
      [la, lheel, 'rgba(251, 191, 36, 0.60)'],
      [lheel, lfoot, 'rgba(251, 191, 36, 0.60)'],
      [lfoot, la, 'rgba(251, 191, 36, 0.40)'],

      // Right Leg & Foot
      [rh, rk, 'rgba(245, 158, 11, 0.75)'],
      [rk, ra, 'rgba(245, 158, 11, 0.75)'],
      [ra, rheel, 'rgba(251, 191, 36, 0.60)'],
      [rheel, rfoot, 'rgba(251, 191, 36, 0.60)'],
      [rfoot, ra, 'rgba(251, 191, 36, 0.40)']
    ];

    // 1. Draw Bones (Outer Glow + Core Line)
    bones.forEach(([ptA, ptB, strokeColor]) => {
      if (!ptA || !ptB) return;
      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);

      // Glow pass
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = options.isProminent ? 3.5 : 2;
      ctx.stroke();

      // Sharp core pass
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = options.isProminent ? 1.5 : 1;
      ctx.stroke();
    });

    // 2. Draw All Joint Nodes
    interface JointNode {
      pt: { x: number; y: number; vis: number } | null;
      label?: string;
      color: string;
      size: number;
    }

    const joints: JointNode[] = [
      // Face
      { pt: nose, color: '#38BDF8', size: 3.5, label: 'NOSE' },
      { pt: leftEye, color: '#38BDF8', size: 2.5 },
      { pt: rightEye, color: '#38BDF8', size: 2.5 },
      { pt: leftEar, color: '#38BDF8', size: 2.5 },
      { pt: rightEar, color: '#38BDF8', size: 2.5 },

      // Central Torso Column
      { pt: neck, color: '#06B6D4', size: 4.5, label: 'NECK' },
      { pt: chest, color: '#06B6D4', size: 4.0, label: 'CHEST' },
      { pt: spine, color: '#06B6D4', size: 3.5, label: 'SPINE' },
      { pt: midHip, color: '#A855F7', size: 4.0, label: 'PELVIS' },

      // Upper Limbs
      { pt: ls, color: '#10B981', size: 4.5, label: 'L_SHOULDER' },
      { pt: rs, color: '#10B981', size: 4.5, label: 'R_SHOULDER' },
      { pt: le, color: '#10B981', size: 4.0, label: 'L_ELBOW' },
      { pt: re, color: '#10B981', size: 4.0, label: 'R_ELBOW' },
      { pt: lw, color: '#34D399', size: 4.5, label: 'L_WRIST' },
      { pt: rw, color: '#34D399', size: 4.5, label: 'R_WRIST' },

      // Hands
      { pt: lt, color: '#6EE7B7', size: 2.5 },
      { pt: li, color: '#6EE7B7', size: 2.5 },
      { pt: lp, color: '#6EE7B7', size: 2.5 },
      { pt: rt, color: '#6EE7B7', size: 2.5 },
      { pt: ri, color: '#6EE7B7', size: 2.5 },
      { pt: rp, color: '#6EE7B7', size: 2.5 },

      // Lower Limbs
      { pt: lh, color: '#A855F7', size: 4.0, label: 'L_HIP' },
      { pt: rh, color: '#A855F7', size: 4.0, label: 'R_HIP' },
      { pt: lk, color: '#F59E0B', size: 4.0, label: 'L_KNEE' },
      { pt: rk, color: '#F59E0B', size: 4.0, label: 'R_KNEE' },
      { pt: la, color: '#FBBF24', size: 4.0, label: 'L_ANKLE' },
      { pt: ra, color: '#FBBF24', size: 4.0, label: 'R_ANKLE' },
      { pt: lheel, color: '#FBBF24', size: 2.5 },
      { pt: rheel, color: '#FBBF24', size: 2.5 },
      { pt: lfoot, color: '#FBBF24', size: 3.0 },
      { pt: rfoot, color: '#FBBF24', size: 3.0 }
    ];

    joints.forEach(({ pt, color, size, label }) => {
      if (!pt) return;

      // Outer glowing halo
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size + 3, 0, Math.PI * 2);
      ctx.fillStyle = `${color}33`; // 20% opacity
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Solid central core node
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Small high-tech joint label
      if (options.showLabels && label) {
        ctx.font = '9px monospace';
        const textW = ctx.measureText(label).width;
        const tagX = pt.x + size + 4;
        const tagY = pt.y - 3;

        ctx.fillStyle = 'rgba(9, 10, 12, 0.85)';
        ctx.fillRect(tagX - 2, tagY - 8, textW + 4, 11);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(tagX - 2, tagY - 8, textW + 4, 11);

        ctx.fillStyle = '#F5F5F7';
        ctx.fillText(label, tagX, tagY);
      }
    });

    // 3. Live HUD Tracking Header (Upper Left Corner)
    if (options.isProminent) {
      const hudX = 14;
      const hudY = 18;
      const hudW = 260;
      const hudH = 50;

      ctx.fillStyle = 'rgba(9, 10, 12, 0.88)';
      ctx.fillRect(hudX, hudY, hudW, hudH);
      ctx.strokeStyle = '#222530';
      ctx.lineWidth = 1;
      ctx.strokeRect(hudX, hudY, hudW, hudH);

      // Status indicator dot
      ctx.beginPath();
      ctx.arc(hudX + 12, hudY + 16, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10B981';
      ctx.fill();

      ctx.fillStyle = '#F5F5F7';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('BODY DETECTED // 33 JOINTS', hudX + 24, hudY + 20);

      ctx.fillStyle = '#7E8294';
      ctx.font = '10px monospace';
      const confPct = Math.round(kp.confidence * 100);
      const spanNorm = Math.round(kp.shoulderWidthNorm * 100);
      ctx.fillText(`TRACKING: ${confPct}% • SHOULDER SPAN: ${spanNorm}%`, hudX + 24, hudY + 38);
    }

    ctx.restore();
  }
}

export const garmentFitter = new GarmentFitter();
