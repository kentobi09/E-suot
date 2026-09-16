import { PoseKeypoints, GarmentItem, FitEngineMode } from './types';

export interface GarmentRenderOptions {
  opacity: number; // 0.0 to 1.0
  wireframeOnly: boolean;
  sizeMultiplier: number; // 0.9 (S) to 1.15 (XXL)
  fitEngine: FitEngineMode;
  showLandmarks: boolean;
}

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
  private renderQuickAffine(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ) {
    const neckX = kp.neckBase.x * canvasWidth;
    const neckY = (kp.neckBase.y + garment.offsetYFactor) * canvasHeight;

    const dx = (kp.rightShoulder.x - kp.leftShoulder.x) * canvasWidth;
    const dy = (kp.rightShoulder.y - kp.leftShoulder.y) * canvasHeight;
    const shoulderSpan = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Garment dimensions based on physical shoulder span and scaling multiplier
    const garmentWidth = shoulderSpan * 1.95 * garment.scaleFactor * options.sizeMultiplier;
    const garmentHeight = garmentWidth / garment.aspectRatio;

    const anchorRelX = garment.anchorPointRatio.x;
    const anchorRelY = garment.anchorPointRatio.y;

    ctx.save();
    ctx.translate(neckX, neckY);
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
    // 4 vertical slice strips across the garment to deform with shoulder curvature
    const slices = 8;
    const leftShoulderX = kp.leftShoulder.x * canvasWidth;
    const leftShoulderY = kp.leftShoulder.y * canvasHeight;
    const rightShoulderX = kp.rightShoulder.x * canvasWidth;
    const rightShoulderY = kp.rightShoulder.y * canvasHeight;
    const neckX = kp.neckBase.x * canvasWidth;
    const neckY = (kp.neckBase.y + garment.offsetYFactor) * canvasHeight;
    const hipX = kp.midHip.x * canvasWidth;
    const hipY = kp.midHip.y * canvasHeight;

    const shoulderSpan = Math.hypot(rightShoulderX - leftShoulderX, rightShoulderY - leftShoulderY);
    const angle = Math.atan2(rightShoulderY - leftShoulderY, rightShoulderX - leftShoulderX);

    const garmentWidth = shoulderSpan * 1.98 * garment.scaleFactor * options.sizeMultiplier;
    const garmentHeight = garmentWidth / garment.aspectRatio;

    const sourceW = (imageSource as HTMLImageElement).naturalWidth || imageSource.width;
    const sourceH = (imageSource as HTMLImageElement).naturalHeight || imageSource.height;

    // Anchor center
    ctx.save();
    ctx.translate(neckX, neckY);
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
   * Minimalist, architectural landmark skeleton rendering (Bone-white #E2E8F0)
   */
  private renderLandmarkSkeleton(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    kp: PoseKeypoints
  ) {
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#E2E8F0';

    const p = (pt?: { x: number; y: number }) => ({
      x: (pt?.x || 0) * w,
      y: (pt?.y || 0) * h
    });

    const ls = p(kp.leftShoulder);
    const rs = p(kp.rightShoulder);
    const lh = p(kp.leftHip);
    const rh = p(kp.rightHip);
    const neck = p(kp.neckBase);
    const midHip = p(kp.midHip);

    // Bone-white hairline skeleton structure
    ctx.beginPath();
    // Shoulder bar
    ctx.moveTo(ls.x, ls.y);
    ctx.lineTo(rs.x, rs.y);
    // Spine
    ctx.moveTo(neck.x, neck.y);
    ctx.lineTo(midHip.x, midHip.y);
    // Pelvic bar
    ctx.moveTo(lh.x, lh.y);
    ctx.lineTo(rh.x, rh.y);
    ctx.stroke();

    // Keypoint dots (3px bone-white squares for high-fashion architectural precision)
    const points = [ls, rs, lh, rh, neck, midHip];
    points.forEach(pt => {
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    });

    ctx.restore();
  }
}

export const garmentFitter = new GarmentFitter();
