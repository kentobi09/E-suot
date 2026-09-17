import * as THREE from 'three';
import { PoseKeypoints, GarmentItem, GarmentRenderOptions } from './types';
import { OneEuroVector3Filter } from './landmarkSmoothing';

export class ThreeGarmentEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

  // Root garment group in pixel space
  private garmentGroup: THREE.Group | null = null;

  // Multi-part articulated mesh components for TOPS
  private torsoMesh: THREE.Mesh | null = null;
  private leftSleeveMesh: THREE.Mesh | null = null;
  private rightSleeveMesh: THREE.Mesh | null = null;

  // Multi-part articulated mesh components for BOTTOMS (Pants)
  private pantsWaistMesh: THREE.Mesh | null = null;
  private pantsLeftLegMesh: THREE.Mesh | null = null;
  private pantsRightLegMesh: THREE.Mesh | null = null;

  // Smoothing filters for arm tracking
  private leftArmVecFilter: OneEuroVector3Filter = new OneEuroVector3Filter(1.8, 0.025);
  private rightArmVecFilter: OneEuroVector3Filter = new OneEuroVector3Filter(1.8, 0.025);

  // Lighting
  private ambientLight: THREE.AmbientLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private leftRimLight: THREE.DirectionalLight | null = null;
  private rightRimLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;

  // Cached textures & procedural maps
  private textureCache: Map<string, THREE.Texture> = new Map();
  private fabricNormalTexture: THREE.CanvasTexture | null = null;
  private denimNormalTexture: THREE.CanvasTexture | null = null;

  // Materials cache
  private topMaterial: THREE.MeshStandardMaterial | null = null;
  private pantsMaterial: THREE.MeshStandardMaterial | null = null;

  private width: number = 0;
  private height: number = 0;

  // Top mesh grid dimensions (cols across, rows down)
  private readonly TORSO_COLS = 16;
  private readonly TORSO_ROWS = 20;
  private readonly SLEEVE_SEGS_LEN = 8;
  private readonly SLEEVE_SEGS_RAD = 8;

  // Pants mesh grid dimensions
  private readonly PANTS_WAIST_COLS = 16;
  private readonly PANTS_WAIST_ROWS = 8;
  private readonly LEG_SEGS_LEN = 12;
  private readonly LEG_SEGS_RAD = 8;

  constructor() {
    this.initThree();
  }

  private initThree() {
    if (typeof window === 'undefined') return;

    this.scene = new THREE.Scene();
    this.garmentGroup = new THREE.Group();
    this.scene.add(this.garmentGroup);

    // 1:1 Pixel-Aligned Orthographic Camera: Origin (0,0) matches canvas center
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);

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

    // Studio 3D Fashion Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    // Key front-top directional light for chest & fold depth
    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    this.keyLight.position.set(0.3, 0.8, 1.5).normalize();
    this.scene.add(this.keyLight);

    // Lateral rim lights for 3D body curvature & silhouette definition
    this.leftRimLight = new THREE.DirectionalLight(0xb0c4de, 0.60);
    this.leftRimLight.position.set(-1.4, 0.2, 0.4).normalize();
    this.scene.add(this.leftRimLight);

    this.rightRimLight = new THREE.DirectionalLight(0xb0c4de, 0.55);
    this.rightRimLight.position.set(1.4, 0.2, 0.4).normalize();
    this.scene.add(this.rightRimLight);

    // Subtle upward fill light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.30);
    this.fillLight.position.set(0, -1.0, 0.5).normalize();
    this.scene.add(this.fillLight);

    // Initialize procedural cloth normal maps
    this.fabricNormalTexture = this.generateProceduralNormalMap();
    this.denimNormalTexture = this.generateDenimNormalMap();

    // Allocate geometry buffers once
    this.initGeometries();
  }

  /**
   * Allocates all mesh geometries once with fixed topology
   */
  private initGeometries() {
    if (!this.scene || !this.garmentGroup) return;

    // 1. Torso Geometry
    const torsoGeom = this.createGridGeometry(this.TORSO_COLS, this.TORSO_ROWS);
    this.topMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });
    this.torsoMesh = new THREE.Mesh(torsoGeom, this.topMaterial);
    this.garmentGroup.add(this.torsoMesh);

    // 2. Left Sleeve Geometry
    const leftSleeveGeom = this.createGridGeometry(this.SLEEVE_SEGS_LEN, this.SLEEVE_SEGS_RAD);
    this.leftSleeveMesh = new THREE.Mesh(leftSleeveGeom, this.topMaterial);
    this.garmentGroup.add(this.leftSleeveMesh);

    // 3. Right Sleeve Geometry
    const rightSleeveGeom = this.createGridGeometry(this.SLEEVE_SEGS_LEN, this.SLEEVE_SEGS_RAD);
    this.rightSleeveMesh = new THREE.Mesh(rightSleeveGeom, this.topMaterial);
    this.garmentGroup.add(this.rightSleeveMesh);

    // 4. Pants Waist Geometry
    const waistGeom = this.createGridGeometry(this.PANTS_WAIST_COLS, this.PANTS_WAIST_ROWS);
    this.pantsMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });
    this.pantsWaistMesh = new THREE.Mesh(waistGeom, this.pantsMaterial);
    this.garmentGroup.add(this.pantsWaistMesh);

    // 5. Pants Legs
    const leftLegGeom = this.createGridGeometry(this.LEG_SEGS_LEN, this.LEG_SEGS_RAD);
    this.pantsLeftLegMesh = new THREE.Mesh(leftLegGeom, this.pantsMaterial);
    this.garmentGroup.add(this.pantsLeftLegMesh);

    const rightLegGeom = this.createGridGeometry(this.LEG_SEGS_LEN, this.LEG_SEGS_RAD);
    this.pantsRightLegMesh = new THREE.Mesh(rightLegGeom, this.pantsMaterial);
    this.garmentGroup.add(this.pantsRightLegMesh);
  }

  /**
   * Creates an empty indexed grid geometry (cols x rows)
   */
  private createGridGeometry(cols: number, rows: number): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const numVerts = cols * rows;
    const positions = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const indices: number[] = [];

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = r * cols + (c + 1);
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + (c + 1);

        indices.push(a, b, d);
        indices.push(b, e, d);
      }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
  }

  /**
   * Resize the renderer and orthographic camera to match native canvas pixels
   */
  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    if (this.camera && this.renderer) {
      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.near = -2000;
      this.camera.far = 2000;
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();

      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
    }
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.renderer ? this.renderer.domElement : null;
  }

  /**
   * Preloads or retrieves a THREE.Texture for custom garment prints or uploaded images
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
   * Generates a procedural base fabric diffuse texture tailored to the selected garment style
   */
  private generateFabricDiffuseTexture(garment: GarmentItem): THREE.CanvasTexture {
    const cacheKey = `diffuse_${garment.id}_${garment.category}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey) as THREE.CanvasTexture;
    }

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      let baseColor = '#FFFFFF';
      let secondaryColor = '#E9ECEF';
      let isOxford = false;

      const isBottoms = garment.category === 'bottoms' || garment.id.includes('trouser') || garment.id.includes('denim');

      if (isBottoms) {
        const isDenim = garment.id.includes('denim');
        baseColor = isDenim ? '#253752' : '#191B22';
        secondaryColor = isDenim ? '#1B283C' : '#111318';

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);

        // Twill weave lines
        ctx.fillStyle = secondaryColor;
        for (let y = 0; y < size; y += 4) {
          for (let x = 0; x < size; x += 4) {
            if ((x + y) % 6 === 0) {
              ctx.fillRect(x, y, 2, 2);
            }
          }
        }
      } else if (garment.id.includes('tee') || garment.name.toLowerCase().includes('tee')) {
        baseColor = '#1F2128';
        secondaryColor = '#181A20';
      } else if (garment.id.includes('oxford') || garment.name.toLowerCase().includes('oxford')) {
        baseColor = '#F4F7FB';
        secondaryColor = '#E4EBF5';
        isOxford = true;
      } else {
        baseColor = '#242730';
        secondaryColor = '#1A1C22';
      }

      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, size, size);

      // Fine fabric grain / melange weave
      ctx.fillStyle = secondaryColor;
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          if ((x + y) % 8 === 0) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }

      if (isOxford) {
        const placketW = 40;
        const placketX = (size - placketW) / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(placketX, 0, placketW, size);
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(placketX, 0, placketW, size);

        for (let btnY = 80; btnY < size; btnY += 90) {
          ctx.beginPath();
          ctx.arc(size / 2, btnY, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Generates a 3x3 twill weave normal map for denim and heavy trousers
   */
  private generateDenimNormalMap(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          const twillLine = Math.sin((x + y) * 0.8) * 16;
          const grain = (Math.random() - 0.5) * 8;
          const nx = Math.max(0, Math.min(255, 128 + twillLine + grain));
          const ny = Math.max(0, Math.min(255, 128 - twillLine));
          data[idx] = nx;
          data[idx + 1] = ny;
          data[idx + 2] = 240;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 10);
    return texture;
  }

  /**
   * Generates a procedural cloth normal map with micro-weave and soft drape folds
   */
  private generateProceduralNormalMap(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          const weave = (Math.sin(x * 0.5) - Math.cos(y * 0.5)) * 12;
          const fold = Math.sin(x * 0.04 + y * 0.05) * 12;
          const nx = Math.max(0, Math.min(255, 128 + weave + fold));
          const ny = Math.max(0, Math.min(255, 128 - weave + fold * 0.5));
          data[idx] = nx;
          data[idx + 1] = ny;
          data[idx + 2] = 245;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 6);
    return texture;
  }

  /**
   * Main 3D Render Loop: Solves Articulated Biometric Garment Mesh and renders WebGL output
   */
  public render3DGarment(
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ): HTMLCanvasElement | null {
    if (!this.renderer || !this.scene || !this.camera || !this.garmentGroup) return null;

    this.resize(canvasWidth, canvasHeight);
    const now = performance.now();

    // -------------------------------------------------------------
    // Real-Time Environmental Lighting Constraint
    // -------------------------------------------------------------
    if (options.environmentalLighting) {
      const { luminance, r, g, b } = options.environmentalLighting;
      if (this.ambientLight) {
        this.ambientLight.intensity = Math.max(0.45, Math.min(1.2, luminance * 1.15));
        this.ambientLight.color.setRGB(r, g, b);
      }
      if (this.keyLight) {
        this.keyLight.intensity = Math.max(0.55, Math.min(1.4, luminance * 1.3));
        this.keyLight.color.setRGB(
          Math.min(1, r * 1.05),
          Math.min(1, g * 1.05),
          Math.min(1, b * 1.05)
        );
      }
    }

    // Convert 2D pixel space to Three.js centered coordinates
    const toThreeX = (px: number) => px - canvasWidth / 2;
    const toThreeY = (py: number) => canvasHeight / 2 - py;

    const isBottoms = garment.category === 'bottoms' || garment.id.includes('trouser') || garment.id.includes('denim');

    // Retrieve active texture
    const tex = (garment.imageUrl && (garment.imageUrl.startsWith('data:') || garment.imageUrl.startsWith('blob:') || garment.imageUrl.startsWith('http') || garment.imageUrl.startsWith('/')))
      ? this.getTexture(garment.imageUrl, imageSource)
      : this.generateFabricDiffuseTexture(garment);

    if (imageSource && (garment.id.startsWith('custom-') || garment.imageUrl.startsWith('blob:'))) {
      tex.needsUpdate = true;
    }

    // Update material properties
    const activeMat = isBottoms ? this.pantsMaterial : this.topMaterial;
    if (activeMat) {
      if (activeMat.map !== tex) {
        activeMat.map = tex;
        activeMat.needsUpdate = true;
      }
      activeMat.normalMap = (isBottoms && garment.id.includes('denim')) ? this.denimNormalTexture : this.fabricNormalTexture;
      activeMat.opacity = options.opacity;
      activeMat.wireframe = options.wireframeOnly;
    }

    // =============================================================
    // BRANCH A: TOPS / SHIRTS ARTICULATED BIOMETRIC MESH
    // =============================================================
    if (!isBottoms) {
      if (this.pantsWaistMesh) this.pantsWaistMesh.visible = false;
      if (this.pantsLeftLegMesh) this.pantsLeftLegMesh.visible = false;
      if (this.pantsRightLegMesh) this.pantsRightLegMesh.visible = false;

      if (this.torsoMesh) this.torsoMesh.visible = true;
      if (this.leftSleeveMesh) this.leftSleeveMesh.visible = true;
      if (this.rightSleeveMesh) this.rightSleeveMesh.visible = true;

      // Identify Screen-Left and Screen-Right landmarks
      const isShLeftKpLeft = kp.leftShoulder.x <= kp.rightShoulder.x;
      const shL = isShLeftKpLeft ? kp.leftShoulder : kp.rightShoulder;
      const shR = isShLeftKpLeft ? kp.rightShoulder : kp.leftShoulder;
      const elL = isShLeftKpLeft ? kp.leftElbow : kp.rightElbow;
      const elR = isShLeftKpLeft ? kp.rightElbow : kp.leftElbow;
      const wrL = isShLeftKpLeft ? kp.leftWrist : kp.rightWrist;
      const wrR = isShLeftKpLeft ? kp.rightWrist : kp.leftWrist;
      const hipL = (kp.leftHip.x <= kp.rightHip.x) ? kp.leftHip : kp.rightHip;
      const hipR = (kp.leftHip.x > kp.rightHip.x) ? kp.leftHip : kp.rightHip;

      // Pixel coordinates
      const pSL = { x: shL.x * canvasWidth, y: shL.y * canvasHeight, z: (shL.z || 0) * canvasWidth };
      const pSR = { x: shR.x * canvasWidth, y: shR.y * canvasHeight, z: (shR.z || 0) * canvasWidth };
      const pNB = {
        x: kp.neckBase.x * canvasWidth,
        y: kp.neckBase.y * canvasHeight + (garment.offsetYFactor || 0) * canvasHeight,
        z: (kp.neckBase.z || 0) * canvasWidth
      };

      // Shoulder telemetry
      const dxSh = pSR.x - pSL.x;
      const dySh = pSR.y - pSL.y;
      const shSpan = Math.hypot(dxSh, dySh);
      const uShX = dxSh / (shSpan || 1);
      const uShY = dySh / (shSpan || 1);
      const nShX = -uShY; // Perpendicular upward
      const nShY = uShX;

      // Sizing with tailored ease
      const sizeMult = options.sizeMultiplier || 1.0;
      const garmentWidth = shSpan * 1.12 * (garment.scaleFactor || 1.0) * sizeMult;
      const shoulderOverhang = (garmentWidth - shSpan) * 0.5;

      // Shoulder Seam Anchors
      const seamL = {
        x: pSL.x - uShX * shoulderOverhang,
        y: pSL.y - uShY * shoulderOverhang,
        z: pSL.z
      };
      const seamR = {
        x: pSR.x + uShX * shoulderOverhang,
        y: pSR.y + uShY * shoulderOverhang,
        z: pSR.z
      };

      // Waist / Hip Anchors
      const defaultTorsoLen = shSpan * 1.35 * sizeMult;
      const pHL = {
        x: hipL ? hipL.x * canvasWidth : pSL.x,
        y: hipL ? hipL.y * canvasHeight : pSL.y + defaultTorsoLen,
        z: hipL ? (hipL.z || 0) * canvasWidth : pSL.z
      };
      const pHR = {
        x: hipR ? hipR.x * canvasWidth : pSR.x,
        y: hipR ? hipR.y * canvasHeight : pSR.y + defaultTorsoLen,
        z: hipR ? (hipR.z || 0) * canvasWidth : pSR.z
      };
      const pHM = {
        x: kp.midHip ? kp.midHip.x * canvasWidth : (pHL.x + pHR.x) / 2,
        y: kp.midHip ? kp.midHip.y * canvasHeight : (pHL.y + pHR.y) / 2,
        z: kp.midHip ? (kp.midHip.z || 0) * canvasWidth : (pHL.z + pHR.z) / 2
      };

      // Hem extension (covers belt line naturally)
      const hemExtension = shSpan * 0.18;
      const hemL = { x: pHL.x - uShX * shoulderOverhang * 0.5, y: pHL.y + hemExtension, z: pHL.z };
      const hemR = { x: pHR.x + uShX * shoulderOverhang * 0.5, y: pHR.y + hemExtension, z: pHR.z };
      const hemM = { x: pHM.x, y: pHM.y + hemExtension, z: pHM.z };

      // Body Yaw and Depth Tilt
      const bodyYaw = Math.max(-0.6, Math.min(0.6, ((pSR.z - pSL.z) / shSpan) * 2.2));
      const chestDepth = Math.max(25, Math.min(65, shSpan * 0.22));

      // -------------------------------------------------------------
      // 1. Solve Torso Mesh Vertices
      // -------------------------------------------------------------
      if (this.torsoMesh) {
        const geom = this.torsoMesh.geometry;
        const posAttr = geom.attributes.position as THREE.BufferAttribute;
        const uvAttr = geom.attributes.uv as THREE.BufferAttribute;
        const cols = this.TORSO_COLS;
        const rows = this.TORSO_ROWS;

        // Cache left and right shoulder seam edge points for sleeve welding
        const leftSeamEdge: THREE.Vector3[] = [];
        const rightSeamEdge: THREE.Vector3[] = [];

        for (let r = 0; r < rows; r++) {
          const vFrac = r / (rows - 1); // 0 at collar, 1 at hem

          const sideL_x = seamL.x * (1 - vFrac) + hemL.x * vFrac;
          const sideL_y = seamL.y * (1 - vFrac) + hemL.y * vFrac;
          const sideL_z = seamL.z * (1 - vFrac) + hemL.z * vFrac;

          const sideR_x = seamR.x * (1 - vFrac) + hemR.x * vFrac;
          const sideR_y = seamR.y * (1 - vFrac) + hemR.y * vFrac;
          const sideR_z = seamR.z * (1 - vFrac) + hemR.z * vFrac;

          const mid_x = pNB.x * (1 - vFrac) + hemM.x * vFrac;
          const mid_y = pNB.y * (1 - vFrac) + hemM.y * vFrac;
          const mid_z = pNB.z * (1 - vFrac) + hemM.z * vFrac;

          for (let c = 0; c < cols; c++) {
            const uFrac = c / (cols - 1); // 0 (left edge) to 1 (right edge)
            const idx = r * cols + c;

            let px: number, py: number, pz: number;
            if (uFrac <= 0.5) {
              const t = uFrac / 0.5;
              px = sideL_x * (1 - t) + mid_x * t;
              py = sideL_y * (1 - t) + mid_y * t;
              pz = sideL_z * (1 - t) + mid_z * t;
            } else {
              const t = (uFrac - 0.5) / 0.5;
              px = mid_x * (1 - t) + sideR_x * t;
              py = mid_y * (1 - t) + sideR_y * t;
              pz = mid_z * (1 - t) + sideR_z * t;
            }

            // Natural Collar Scoop (curved dip around suprasternal notch)
            if (vFrac < 0.18) {
              const collarScoop = Math.cos((uFrac - 0.5) * Math.PI);
              if (collarScoop > 0) {
                const scoopAmt = (1 - vFrac / 0.18) * (shSpan * 0.08) * collarScoop;
                py += scoopAmt;
              }
            }

            // Natural 3D Chest & Pecs Curvature
            const pecBulge = Math.sin(vFrac * Math.PI) * Math.cos((uFrac - 0.5) * Math.PI);
            const zCurvature = pecBulge * chestDepth;
            const zYaw = (uFrac - 0.5) * bodyYaw * garmentWidth * 0.45;

            const tx = toThreeX(px);
            const ty = toThreeY(py);
            const tz = pz + zCurvature + zYaw;

            posAttr.setXYZ(idx, tx, ty, tz);

            if (c === 0 && r < this.SLEEVE_SEGS_RAD) {
              leftSeamEdge.push(new THREE.Vector3(tx, ty, tz));
            }
            if (c === cols - 1 && r < this.SLEEVE_SEGS_RAD) {
              rightSeamEdge.push(new THREE.Vector3(tx, ty, tz));
            }

            // UV mapping: Torso covers central 56% of shirt image
            const uTex = 0.22 + uFrac * 0.56;
            const vTex = 0.06 + vFrac * 0.90;
            uvAttr.setXY(idx, uTex, 1.0 - vTex);
          }
        }

        posAttr.needsUpdate = true;
        uvAttr.needsUpdate = true;
        geom.computeVertexNormals();

        // -------------------------------------------------------------
        // 2. Solve Articulated Left Sleeve Mesh (Seamlessly Welded Seam)
        // -------------------------------------------------------------
        if (this.leftSleeveMesh) {
          const sGeom = this.leftSleeveMesh.geometry;
          const sPos = sGeom.attributes.position as THREE.BufferAttribute;
          const sUv = sGeom.attributes.uv as THREE.BufferAttribute;
          const sLen = this.SLEEVE_SEGS_LEN;
          const sRad = this.SLEEVE_SEGS_RAD;

          let armVecX = -uShX * 0.35 + nShY * 0.93;
          let armVecY = -uShY * 0.35 - nShX * 0.93;
          let armDist = shSpan * 0.70;

          if (elL && (elL.visibility || 0.5) > 0.25) {
            const rawDx = elL.x * canvasWidth - pSL.x;
            const rawDy = elL.y * canvasHeight - pSL.y;
            const rawLen = Math.hypot(rawDx, rawDy);
            if (rawLen > 15) {
              armVecX = rawDx / rawLen;
              armVecY = rawDy / rawLen;
              armDist = rawLen;
            }
          }

          const filtArm = this.leftArmVecFilter.filter(new THREE.Vector3(armVecX, armVecY, 0), now);
          armVecX = filtArm.x;
          armVecY = filtArm.y;

          const isLongSleeve = garment.category === 'outerwear' || garment.id.includes('oxford') || garment.name.toLowerCase().includes('long');
          const maxSleeveLen = shSpan * (isLongSleeve ? 1.15 : 0.50);
          const sleeveLen = Math.min(maxSleeveLen, armDist * (isLongSleeve ? 0.95 : 0.55));

          const armPerpX = -armVecY;
          const armPerpY = armVecX;

          for (let k = 0; k < sLen; k++) {
            const kFrac = k / (sLen - 1);
            const cuffCenter_x = seamL.x + armVecX * (sleeveLen * kFrac);
            const cuffCenter_y = seamL.y + armVecY * (sleeveLen * kFrac);
            const sleeveRadius = shSpan * 0.17 * (1.0 - kFrac * 0.15);

            for (let l = 0; l < sRad; l++) {
              const lFrac = l / (sRad - 1);
              const sIdx = k * sRad + l;

              let tx: number, ty: number, tz: number;

              if (k === 0 && l < leftSeamEdge.length) {
                // Welded to Torso Left Seam! Zero gap, zero tearing!
                const pt = leftSeamEdge[l];
                tx = pt.x;
                ty = pt.y;
                tz = pt.z;
              } else {
                const lateralOffset = (lFrac - 0.5) * 2 * sleeveRadius;
                const px = cuffCenter_x + armPerpX * lateralOffset;
                const py = cuffCenter_y + armPerpY * lateralOffset;
                tx = toThreeX(px);
                ty = toThreeY(py);
                const armZ = (elL ? (elL.z || 0) * canvasWidth : 0) * kFrac;
                tz = seamL.z + armZ + (1 - Math.abs(lFrac - 0.5) * 2) * (sleeveRadius * 0.5);
              }

              sPos.setXYZ(sIdx, tx, ty, tz);

              const uTex = 0.22 - kFrac * 0.20;
              const vTex = 0.08 + lFrac * 0.38;
              sUv.setXY(sIdx, uTex, 1.0 - vTex);
            }
          }

          sPos.needsUpdate = true;
          sUv.needsUpdate = true;
          sGeom.computeVertexNormals();
        }

        // -------------------------------------------------------------
        // 3. Solve Articulated Right Sleeve Mesh (Seamlessly Welded Seam)
        // -------------------------------------------------------------
        if (this.rightSleeveMesh) {
          const sGeom = this.rightSleeveMesh.geometry;
          const sPos = sGeom.attributes.position as THREE.BufferAttribute;
          const sUv = sGeom.attributes.uv as THREE.BufferAttribute;
          const sLen = this.SLEEVE_SEGS_LEN;
          const sRad = this.SLEEVE_SEGS_RAD;

          let armVecX = uShX * 0.35 + nShY * 0.93;
          let armVecY = uShY * 0.35 - nShX * 0.93;
          let armDist = shSpan * 0.70;

          if (elR && (elR.visibility || 0.5) > 0.25) {
            const rawDx = elR.x * canvasWidth - pSR.x;
            const rawDy = elR.y * canvasHeight - pSR.y;
            const rawLen = Math.hypot(rawDx, rawDy);
            if (rawLen > 15) {
              armVecX = rawDx / rawLen;
              armVecY = rawDy / rawLen;
              armDist = rawLen;
            }
          }

          const filtArm = this.rightArmVecFilter.filter(new THREE.Vector3(armVecX, armVecY, 0), now);
          armVecX = filtArm.x;
          armVecY = filtArm.y;

          const isLongSleeve = garment.category === 'outerwear' || garment.id.includes('oxford') || garment.name.toLowerCase().includes('long');
          const maxSleeveLen = shSpan * (isLongSleeve ? 1.15 : 0.50);
          const sleeveLen = Math.min(maxSleeveLen, armDist * (isLongSleeve ? 0.95 : 0.55));

          const armPerpX = armVecY;
          const armPerpY = -armVecX;

          for (let k = 0; k < sLen; k++) {
            const kFrac = k / (sLen - 1);
            const cuffCenter_x = seamR.x + armVecX * (sleeveLen * kFrac);
            const cuffCenter_y = seamR.y + armVecY * (sleeveLen * kFrac);
            const sleeveRadius = shSpan * 0.17 * (1.0 - kFrac * 0.15);

            for (let l = 0; l < sRad; l++) {
              const lFrac = l / (sRad - 1);
              const sIdx = k * sRad + l;

              let tx: number, ty: number, tz: number;

              if (k === 0 && l < rightSeamEdge.length) {
                // Welded to Torso Right Seam! Zero gap, zero tearing!
                const pt = rightSeamEdge[l];
                tx = pt.x;
                ty = pt.y;
                tz = pt.z;
              } else {
                const lateralOffset = (lFrac - 0.5) * 2 * sleeveRadius;
                const px = cuffCenter_x + armPerpX * lateralOffset;
                const py = cuffCenter_y + armPerpY * lateralOffset;
                tx = toThreeX(px);
                ty = toThreeY(py);
                const armZ = (elR ? (elR.z || 0) * canvasWidth : 0) * kFrac;
                tz = seamR.z + armZ + (1 - Math.abs(lFrac - 0.5) * 2) * (sleeveRadius * 0.5);
              }

              sPos.setXYZ(sIdx, tx, ty, tz);

              const uTex = 0.78 + kFrac * 0.20;
              const vTex = 0.08 + lFrac * 0.38;
              sUv.setXY(sIdx, uTex, 1.0 - vTex);
            }
          }

          sPos.needsUpdate = true;
          sUv.needsUpdate = true;
          sGeom.computeVertexNormals();
        }
      }
    } else {
      // =============================================================
      // BRANCH B: BOTTOMS / PANTS ARTICULATED BIOMETRIC MESH
      // =============================================================
      if (this.torsoMesh) this.torsoMesh.visible = false;
      if (this.leftSleeveMesh) this.leftSleeveMesh.visible = false;
      if (this.rightSleeveMesh) this.rightSleeveMesh.visible = false;

      if (this.pantsWaistMesh) this.pantsWaistMesh.visible = true;
      if (this.pantsLeftLegMesh) this.pantsLeftLegMesh.visible = true;
      if (this.pantsRightLegMesh) this.pantsRightLegMesh.visible = true;

      const hipL = (kp.leftHip.x <= kp.rightHip.x) ? kp.leftHip : kp.rightHip;
      const hipR = (kp.leftHip.x > kp.rightHip.x) ? kp.leftHip : kp.rightHip;
      const kneeL = (kp.leftHip.x <= kp.rightHip.x) ? kp.leftKnee : kp.rightKnee;
      const kneeR = (kp.leftHip.x > kp.rightHip.x) ? kp.leftKnee : kp.rightKnee;
      const ankleL = (kp.leftHip.x <= kp.rightHip.x) ? kp.leftAnkle : kp.rightAnkle;
      const ankleR = (kp.leftHip.x > kp.rightHip.x) ? kp.leftAnkle : kp.rightAnkle;

      const pHL = { x: hipL.x * canvasWidth, y: hipL.y * canvasHeight, z: (hipL.z || 0) * canvasWidth };
      const pHR = { x: hipR.x * canvasWidth, y: hipR.y * canvasHeight, z: (hipR.z || 0) * canvasWidth };
      const pHM = {
        x: kp.midHip ? kp.midHip.x * canvasWidth : (pHL.x + pHR.x) / 2,
        y: kp.midHip ? kp.midHip.y * canvasHeight : (pHL.y + pHR.y) / 2,
        z: kp.midHip ? (kp.midHip.z || 0) * canvasWidth : (pHL.z + pHR.z) / 2
      };

      const hipDx = pHR.x - pHL.x;
      const hipDy = pHR.y - pHL.y;
      const hipSpan = Math.hypot(hipDx, hipDy);
      const waistWidth = hipSpan * 1.35 * (options.sizeMultiplier || 1.0);
      const waistOverhang = (waistWidth - hipSpan) * 0.5;

      const waistL = { x: pHL.x - (hipDx / hipSpan) * waistOverhang, y: pHL.y - 15 };
      const waistR = { x: pHR.x + (hipDx / hipSpan) * waistOverhang, y: pHR.y - 15 };
      const crotchY = pHM.y + hipSpan * 0.40;

      // 1. Waistband Mesh
      if (this.pantsWaistMesh) {
        const geom = this.pantsWaistMesh.geometry;
        const pos = geom.attributes.position as THREE.BufferAttribute;
        const uv = geom.attributes.uv as THREE.BufferAttribute;
        const cols = this.PANTS_WAIST_COLS;
        const rows = this.PANTS_WAIST_ROWS;

        for (let r = 0; r < rows; r++) {
          const vFrac = r / (rows - 1);
          for (let c = 0; c < cols; c++) {
            const uFrac = c / (cols - 1);
            const idx = r * cols + c;

            const px = waistL.x * (1 - uFrac) + waistR.x * uFrac;
            const py = (waistL.y * (1 - uFrac) + waistR.y * uFrac) * (1 - vFrac) + crotchY * vFrac;
            const zCurvature = Math.sin(uFrac * Math.PI) * (hipSpan * 0.15);

            pos.setXYZ(idx, toThreeX(px), toThreeY(py), zCurvature);
            uv.setXY(idx, uFrac, 1.0 - vFrac * 0.35);
          }
        }
        pos.needsUpdate = true;
        uv.needsUpdate = true;
        geom.computeVertexNormals();
      }

      // 2. Left Leg Mesh
      if (this.pantsLeftLegMesh) {
        const geom = this.pantsLeftLegMesh.geometry;
        const pos = geom.attributes.position as THREE.BufferAttribute;
        const uv = geom.attributes.uv as THREE.BufferAttribute;
        const segsLen = this.LEG_SEGS_LEN;
        const segsRad = this.LEG_SEGS_RAD;

        const defaultKneeY = crotchY + canvasHeight * 0.24;
        const pKL = {
          x: kneeL && (kneeL.visibility || 0.5) > 0.25 ? kneeL.x * canvasWidth : pHL.x - 5,
          y: kneeL && (kneeL.visibility || 0.5) > 0.25 ? kneeL.y * canvasHeight : defaultKneeY
        };
        const pAL = {
          x: ankleL && (ankleL.visibility || 0.5) > 0.25 ? ankleL.x * canvasWidth : pKL.x,
          y: ankleL && (ankleL.visibility || 0.5) > 0.25 ? ankleL.y * canvasHeight : defaultKneeY + canvasHeight * 0.22
        };

        const legRadius = hipSpan * 0.24;

        for (let k = 0; k < segsLen; k++) {
          const kFrac = k / (segsLen - 1);
          let cx: number, cy: number;

          if (kFrac <= 0.5) {
            const t = kFrac / 0.5;
            cx = pHL.x * (1 - t) + pKL.x * t;
            cy = crotchY * (1 - t) + pKL.y * t;
          } else {
            const t = (kFrac - 0.5) / 0.5;
            cx = pKL.x * (1 - t) + pAL.x * t;
            cy = pKL.y * (1 - t) + pAL.y * t;
          }

          const r = legRadius * (1.0 - kFrac * 0.28);

          for (let l = 0; l < segsRad; l++) {
            const lFrac = l / (segsRad - 1);
            const idx = k * segsRad + l;
            const px = cx + (lFrac - 0.5) * 2 * r;
            const py = cy;
            const pz = Math.sin(lFrac * Math.PI) * (r * 0.8);

            pos.setXYZ(idx, toThreeX(px), toThreeY(py), pz);
            uv.setXY(idx, lFrac * 0.48, 1.0 - (0.35 + kFrac * 0.65));
          }
        }
        pos.needsUpdate = true;
        uv.needsUpdate = true;
        geom.computeVertexNormals();
      }

      // 3. Right Leg Mesh
      if (this.pantsRightLegMesh) {
        const geom = this.pantsRightLegMesh.geometry;
        const pos = geom.attributes.position as THREE.BufferAttribute;
        const uv = geom.attributes.uv as THREE.BufferAttribute;
        const segsLen = this.LEG_SEGS_LEN;
        const segsRad = this.LEG_SEGS_RAD;

        const defaultKneeY = crotchY + canvasHeight * 0.24;
        const pKR = {
          x: kneeR && (kneeR.visibility || 0.5) > 0.25 ? kneeR.x * canvasWidth : pHR.x + 5,
          y: kneeR && (kneeR.visibility || 0.5) > 0.25 ? kneeR.y * canvasHeight : defaultKneeY
        };
        const pAR = {
          x: ankleR && (ankleR.visibility || 0.5) > 0.25 ? ankleR.x * canvasWidth : pKR.x,
          y: ankleR && (ankleR.visibility || 0.5) > 0.25 ? ankleR.y * canvasHeight : defaultKneeY + canvasHeight * 0.22
        };

        const legRadius = hipSpan * 0.24;

        for (let k = 0; k < segsLen; k++) {
          const kFrac = k / (segsLen - 1);
          let cx: number, cy: number;

          if (kFrac <= 0.5) {
            const t = kFrac / 0.5;
            cx = pHR.x * (1 - t) + pKR.x * t;
            cy = crotchY * (1 - t) + pKR.y * t;
          } else {
            const t = (kFrac - 0.5) / 0.5;
            cx = pKR.x * (1 - t) + pAR.x * t;
            cy = pKR.y * (1 - t) + pAR.y * t;
          }

          const r = legRadius * (1.0 - kFrac * 0.28);

          for (let l = 0; l < segsRad; l++) {
            const lFrac = l / (segsRad - 1);
            const idx = k * segsRad + l;
            const px = cx + (lFrac - 0.5) * 2 * r;
            const py = cy;
            const pz = Math.sin(lFrac * Math.PI) * (r * 0.8);

            pos.setXYZ(idx, toThreeX(px), toThreeY(py), pz);
            uv.setXY(idx, 0.52 + lFrac * 0.48, 1.0 - (0.35 + kFrac * 0.65));
          }
        }
        pos.needsUpdate = true;
        uv.needsUpdate = true;
        geom.computeVertexNormals();
      }
    }

    // Render WebGL Scene directly onto output canvas
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }
}

export const threeGarmentEngine = new ThreeGarmentEngine();
