import * as THREE from 'three';
import { PoseKeypoints, GarmentItem, GarmentRenderOptions } from './types';

export class ThreeGarmentEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private pivotGroup: THREE.Group | null = null;
  private garmentMesh: THREE.Mesh | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private currentTextureUrl: string | null = null;

  private width: number = 0;
  private height: number = 0;

  constructor() {
    this.initThree();
  }

  private initThree() {
    if (typeof window === 'undefined') return;

    this.scene = new THREE.Scene();
    this.pivotGroup = new THREE.Group();
    this.scene.add(this.pivotGroup);

    // Orthographic camera for 1:1 pixel coordinates mapping
    this.camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 3000);
    this.camera.position.z = 1000;

    // Off-screen canvas for WebGL rendering with transparent alpha background
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);

    // Architectural luxury lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    this.scene.add(this.ambientLight);

    // Key light from top-front
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
    this.dirLight.position.set(0.3, 1, 1.2).normalize();
    this.scene.add(this.dirLight);

    // Soft rim / fill light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    this.fillLight.position.set(-0.3, -0.5, 0.8).normalize();
    this.scene.add(this.fillLight);
  }

  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    if (this.camera && this.renderer) {
      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.updateProjectionMatrix();

      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
    }
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.renderer ? this.renderer.domElement : null;
  }

  /**
   * Preloads or retrieves a THREE.Texture for the garment
   */
  public getTexture(url: string, imageSource?: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }

    let texture: THREE.Texture;
    if (imageSource) {
      texture = new THREE.CanvasTexture(imageSource);
    } else {
      const loader = new THREE.TextureLoader();
      texture = loader.load(url);
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    this.textureCache.set(url, texture);
    return texture;
  }

  /**
   * Builds or updates the 3D parametric cylindrical torso mesh
   */
  private updateGarmentMesh(
    garmentWidth: number,
    garmentHeight: number,
    anchorY: number,
    chestDepth: number,
    shoulderDroop: number,
    texture: THREE.Texture,
    options: GarmentRenderOptions
  ) {
    const segmentsX = 28;
    const segmentsY = 28;

    // Dispose old mesh geometry if exists
    if (this.garmentMesh) {
      this.pivotGroup?.remove(this.garmentMesh);
      this.garmentMesh.geometry.dispose();
      (this.garmentMesh.material as THREE.Material).dispose();
      this.garmentMesh = null;
    }

    const geometry = new THREE.PlaneGeometry(garmentWidth, garmentHeight, segmentsX, segmentsY);
    const posAttr = geometry.attributes.position;

    // Parametric 3D Torso Surface Deformation
    // Wraps the plane around an elliptical 3D chest cylinder with trapezius slope and sleeve droop
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);

      // Normalized horizontal coordinate: -1 (left sleeve) to 0 (chest midline) to +1 (right sleeve)
      const u = x / (garmentWidth / 2);
      // Normalized vertical coordinate: 0 (collar) to 1 (hem)
      const v = (garmentHeight / 2 - y) / garmentHeight;

      // 1. Cylindrical chest curvature: center pushes forward, sides curve backward into depth
      const zCurvature = Math.cos(u * Math.PI * 0.45) * chestDepth;

      // 2. Anatomical shoulder slope: sleeves drape down naturally away from neck
      const droop = Math.abs(u) > 0.35 ? -Math.pow(Math.abs(u) - 0.35, 1.3) * shoulderDroop : 0;

      // 3. Clavicle contour: upper collar curves slightly around the throat
      const collarCurve = v < 0.25 ? -Math.cos(u * Math.PI * 0.5) * (chestDepth * 0.3) : 0;

      posAttr.setY(i, y + droop);
      posAttr.setZ(i, zCurvature + collarCurve);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: options.opacity,
      alphaTest: 0.02,
      roughness: 0.68,
      metalness: 0.05,
      side: THREE.DoubleSide,
      wireframe: options.wireframeOnly
    });

    this.garmentMesh = new THREE.Mesh(geometry, material);
    this.pivotGroup?.add(this.garmentMesh);
  }

  /**
   * Main 3D Render call: computes 3D pitch/yaw/roll and renders to WebGL canvas
   */
  public render3DGarment(
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ): HTMLCanvasElement | null {
    if (!this.renderer || !this.scene || !this.camera) return null;

    this.resize(canvasWidth, canvasHeight);

    // Screen-space shoulder sorting
    const shLeft = kp.leftShoulder.x <= kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;
    const shRight = kp.leftShoulder.x > kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;

    const shLeftX = shLeft.x * canvasWidth;
    const shLeftY = shLeft.y * canvasHeight;
    const shRightX = shRight.x * canvasWidth;
    const shRightY = shRight.y * canvasHeight;

    const dx = shRightX - shLeftX;
    const dy = shRightY - shLeftY;
    const shoulderSpan = Math.hypot(dx, dy);

    // Shoulder line tilt angle in radians
    const rawAngle = Math.atan2(dy, dx);
    const maxTilt = (35 * Math.PI) / 180;
    const rollAngle = Math.max(-maxTilt, Math.min(maxTilt, rawAngle));

    // True 3D Yaw Rotation from landmarks (when user turns their body)
    const bodyYaw = (kp.rightShoulder.z || 0) - (kp.leftShoulder.z || 0);
    const yawAngle = Math.max(-0.5, Math.min(0.5, bodyYaw * 2.0));

    // True 3D Pitch (leaning forward/backward)
    const spineDz = (kp.midHip.z || 0) - (kp.neckBase.z || 0);
    const pitchAngle = Math.max(-0.3, Math.min(0.3, spineDz * 1.2));

    const shMidX = (shLeftX + shRightX) / 2;
    const shMidY = (shLeftY + shRightY) / 2;

    // Upward perpendicular unit vector from shoulder line towards head
    const upX = Math.sin(rollAngle);
    const upY = -Math.cos(rollAngle);

    // Anatomical suprasternal notch collar elevation above shoulder midpoint
    const neckElev = shoulderSpan * 0.08;
    const collarCanvasX = shMidX + upX * neckElev;
    const collarCanvasY = shMidY + upY * neckElev + (garment.offsetYFactor || 0) * canvasHeight;

    // Garment dimensions based on physical shoulder-to-shoulder seam ratio
    const shoulderRatio = garment.shoulderSpanRatio || 0.68;
    const garmentWidth = (shoulderSpan / shoulderRatio) * (garment.scaleFactor || 1.0) * options.sizeMultiplier;
    const garmentHeight = garmentWidth / garment.aspectRatio;

    // Convert 2D canvas coordinates (origin top-left) to Three.js Orthographic coordinates (origin center of screen)
    const threeX = collarCanvasX - canvasWidth / 2;
    const threeY = canvasHeight / 2 - collarCanvasY;

    // 3D Chest depth proportional to shoulder width
    const chestDepth = Math.max(20, Math.min(50, shoulderSpan * 0.16));
    const shoulderDroop = shoulderSpan * 0.10;

    // Texture handling
    const texture = this.getTexture(garment.imageUrl, imageSource);
    texture.needsUpdate = true;

    // Rebuild/update parametric 3D mesh
    this.updateGarmentMesh(
      garmentWidth,
      garmentHeight,
      garment.anchorPointRatio.y,
      chestDepth,
      shoulderDroop,
      texture,
      options
    );

    if (this.pivotGroup && this.garmentMesh) {
      // Set pivot at the exact collar location
      this.pivotGroup.position.set(threeX, threeY, 0);

      // Rotate around the collar pivot
      this.pivotGroup.rotation.order = 'ZYX';
      this.pivotGroup.rotation.z = -rollAngle;  // Roll (shoulder tilt)
      this.pivotGroup.rotation.y = yawAngle;    // Yaw (body turn)
      this.pivotGroup.rotation.x = -pitchAngle; // Pitch (leaning in 3D)

      // The collar notch inside the mesh geometry is at:
      // +garmentHeight * (0.5 - anchorPointRatio.y)
      // To align the collar notch with the pivot origin (0, 0), offset the mesh downward:
      const meshOffsetY = -garmentHeight * (0.5 - garment.anchorPointRatio.y);
      this.garmentMesh.position.set(0, meshOffsetY, 0);

      // Dynamic light tracking with body yaw
      if (this.dirLight) {
        this.dirLight.position.set(0.3 + yawAngle * 0.5, 1, 1.2).normalize();
      }
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);

    return this.renderer.domElement;
  }
}

export const threeGarmentEngine = new ThreeGarmentEngine();
