import * as THREE from 'three';

/**
 * Production-Grade Occlusion & Depth Buffer Pipeline
 * Writes user silhouette segmentation into the WebGL depth buffer (Z-buffer) with:
 *   colorWrite: false
 *   depthWrite: true
 *   renderOrder: -10
 * 
 * Ensures the user's real-world chin, neck, and arms occlude the back collar,
 * inside of the shirt, and interior sleeves naturally.
 */
export class OcclusionPipeline {
  private occlusionMesh: THREE.Mesh | null = null;
  private maskTexture: THREE.CanvasTexture | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private occlusionMaterial: THREE.MeshBasicMaterial | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initCanvas();
  }

  private initCanvas(): void {
    if (typeof document === 'undefined') return;

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = 256;
    this.maskCanvas.height = 256;
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    if (this.maskCtx) {
      // Clear with transparent black
      this.maskCtx.fillStyle = 'rgba(0, 0, 0, 0)';
      this.maskCtx.fillRect(0, 0, 256, 256);
    }

    this.maskTexture = new THREE.CanvasTexture(this.maskCanvas);
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.magFilter = THREE.LinearFilter;
    this.maskTexture.generateMipmaps = false;

    // Depth-only occlusion material
    this.occlusionMaterial = new THREE.MeshBasicMaterial({
      map: this.maskTexture,
      transparent: true,
      alphaTest: 0.45,   // Pixels inside silhouette write to depth; background pixels are discarded
      colorWrite: false, // Never write color to screen buffer (invisible silhouette)
      depthWrite: true,  // Write to Z-buffer
      depthTest: true,
      side: THREE.DoubleSide
    });
  }

  /**
   * Attaches or updates the occlusion plane inside the Three.js scene
   * Positioned slightly in front of the user's spine depth to act as a human body depth mask
   */
  public getOrCreateMesh(scene: THREE.Scene, camera: THREE.PerspectiveCamera): THREE.Mesh {
    if (this.occlusionMesh) {
      return this.occlusionMesh;
    }

    // Full-view quad sized to camera frustum
    const aspect = camera.aspect || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const planeDistance = 1.8; // Approximate distance in meters
    const planeHeight = 2.0 * Math.tan(vFov / 2) * planeDistance;
    const planeWidth = planeHeight * aspect;

    const planeGeom = new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1);
    this.occlusionMesh = new THREE.Mesh(planeGeom, this.occlusionMaterial!);
    this.occlusionMesh.name = 'UserOcclusionMask';
    this.occlusionMesh.renderOrder = -10; // Must render before any garment meshes!
    this.occlusionMesh.position.set(0, 0, -planeDistance + 0.05);

    scene.add(this.occlusionMesh);
    return this.occlusionMesh;
  }

  /**
   * Updates the depth mask texture with a new segmentation mask
   * Supports ImageBitmap, HTMLCanvasElement, or raw ImageData from MediaPipe
   */
  public updateMask(
    sourceMask: HTMLCanvasElement | HTMLImageElement | ImageBitmap | ImageData
  ): void {
    if (!this.maskCanvas || !this.maskCtx || !this.maskTexture || !this.isEnabled) return;

    if (sourceMask instanceof ImageData) {
      if (this.maskCanvas.width !== sourceMask.width || this.maskCanvas.height !== sourceMask.height) {
        this.maskCanvas.width = sourceMask.width;
        this.maskCanvas.height = sourceMask.height;
      }
      this.maskCtx.putImageData(sourceMask, 0, 0);
    } else {
      const srcW = (sourceMask as any).width || (sourceMask as any).naturalWidth || 256;
      const srcH = (sourceMask as any).height || (sourceMask as any).naturalHeight || 256;

      if (this.maskCanvas.width !== srcW || this.maskCanvas.height !== srcH) {
        this.maskCanvas.width = srcW;
        this.maskCanvas.height = srcH;
      }
      this.maskCtx.drawImage(sourceMask as any, 0, 0);
    }

    this.maskTexture.needsUpdate = true;
  }

  /**
   * Dynamically positions the occlusion plane to match the user's estimated metric distance
   */
  public updateDepth(userDistanceMeters: number, camera: THREE.PerspectiveCamera): void {
    if (!this.occlusionMesh) return;

    const dist = Math.max(0.8, Math.min(3.5, userDistanceMeters));
    const vFov = (camera.fov * Math.PI) / 180;
    const planeHeight = 2.0 * Math.tan(vFov / 2) * dist;
    const planeWidth = planeHeight * camera.aspect;

    this.occlusionMesh.scale.set(planeWidth, planeHeight, 1);
    // Position mask just slightly anterior to mid-chest so clothing front remains visible
    this.occlusionMesh.position.set(0, 0, -dist + 0.04);
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (this.occlusionMesh) {
      this.occlusionMesh.visible = enabled;
    }
  }

  public dispose(): void {
    if (this.occlusionMesh) {
      if (this.occlusionMesh.parent) {
        this.occlusionMesh.parent.remove(this.occlusionMesh);
      }
      this.occlusionMesh.geometry.dispose();
      this.occlusionMesh = null;
    }
    if (this.maskTexture) {
      this.maskTexture.dispose();
      this.maskTexture = null;
    }
  }
}
