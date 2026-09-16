import * as THREE from 'three';
import { PoseKeypoints, GarmentItem, GarmentRenderOptions } from './types';

export class ThreeGarmentEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private pivotGroup: THREE.Group | null = null;

  // Multi-part 3D garment mesh components
  private torsoMesh: THREE.Mesh | null = null;
  private leftSleeveMesh: THREE.Mesh | null = null;
  private rightSleeveMesh: THREE.Mesh | null = null;
  private collarMesh: THREE.Mesh | null = null;
  private chestGraphicMesh: THREE.Mesh | null = null;

  // Lighting
  private ambientLight: THREE.AmbientLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private leftRimLight: THREE.DirectionalLight | null = null;
  private rightRimLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;

  // Cached textures & procedural maps
  private textureCache: Map<string, THREE.Texture> = new Map();
  private fabricNormalTexture: THREE.CanvasTexture | null = null;

  private width: number = 0;
  private height: number = 0;
  private readonly fov: number = 50; // Standard optical camera vertical FOV

  constructor() {
    this.initThree();
  }

  private initThree() {
    if (typeof window === 'undefined') return;

    this.scene = new THREE.Scene();
    this.pivotGroup = new THREE.Group();
    this.scene.add(this.pivotGroup);

    // True Perspective Camera: creates genuine 3D depth and perspective foreshortening
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 1, 6000);

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
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    // Key front-top directional light for chest & fold depth
    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    this.keyLight.position.set(0.3, 1.0, 1.5).normalize();
    this.scene.add(this.keyLight);

    // Dual lateral rim lights for 3D body curvature & silhouette definition
    this.leftRimLight = new THREE.DirectionalLight(0xb0c4de, 0.70);
    this.leftRimLight.position.set(-1.4, 0.2, -0.3).normalize();
    this.scene.add(this.leftRimLight);

    this.rightRimLight = new THREE.DirectionalLight(0xb0c4de, 0.65);
    this.rightRimLight.position.set(1.4, 0.2, -0.3).normalize();
    this.scene.add(this.rightRimLight);

    // Subtle upward fill light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    this.fillLight.position.set(0, -1.0, 0.7).normalize();
    this.scene.add(this.fillLight);

    // Initialize procedural cloth normal map
    this.fabricNormalTexture = this.generateProceduralNormalMap();
  }

  /**
   * Generates a dynamic, high-resolution procedural cloth micro-weave and fold normal map
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

          // 1. High-frequency micro-weave (warp & weft threads)
          const weaveFreq = 0.55;
          const weaveX = Math.sin(x * weaveFreq);
          const weaveY = Math.cos(y * weaveFreq);
          const weaveVal = (weaveX - weaveY) * 16;

          // 2. Macro diagonal drapery / tension folds
          const fold1 = Math.sin((x * 0.04 + y * 0.05)) * 14;
          const fold2 = Math.sin((x * 0.03 - y * 0.06)) * 10;
          const totalFold = fold1 + fold2;

          // Tangent space normal calculation
          const nx = Math.max(0, Math.min(255, 128 + weaveVal + totalFold));
          const ny = Math.max(0, Math.min(255, 128 - weaveVal + totalFold * 0.5));
          const nz = 245;

          data[idx] = nx;     // Red = Normal X
          data[idx + 1] = ny; // Green = Normal Y
          data[idx + 2] = nz; // Blue = Normal Z
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 6);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }

  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.fov = this.fov;

      // Distance D so that 1 world unit at Z=0 corresponds to exactly 1 pixel on the 2D canvas
      const fovRad = (this.fov * Math.PI) / 360;
      const cameraDistance = height / (2 * Math.tan(fovRad));
      this.camera.position.set(0, 0, cameraDistance);
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
      // Determine base color palette from garment ID or category
      let baseColor = '#FFFFFF';
      let secondaryColor = '#E9ECEF';
      let isOxford = false;
      let isOvershirt = false;

      if (garment.id.includes('tee') || garment.name.toLowerCase().includes('tee')) {
        baseColor = '#1F2128';
        secondaryColor = '#181A20';
      } else if (garment.id.includes('oxford') || garment.name.toLowerCase().includes('oxford')) {
        baseColor = '#F4F7FB';
        secondaryColor = '#E4EBF5';
        isOxford = true;
      } else if (garment.id.includes('overshirt') || garment.name.toLowerCase().includes('overshirt')) {
        baseColor = '#282C37';
        secondaryColor = '#1E212B';
        isOvershirt = true;
      } else {
        baseColor = '#242730';
        secondaryColor = '#1A1C22';
      }

      // Base textile fill
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

      // Oxford: button placket down the front midline
      if (isOxford) {
        const placketW = 44;
        const placketX = (size - placketW) / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(placketX, 0, placketW, size);
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(placketX, 0, placketW, size);

        // Pearl buttons
        for (let btnY = 80; btnY < size; btnY += 90) {
          ctx.beginPath();
          ctx.arc(size / 2, btnY, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Button holes
          ctx.fillStyle = '#64748B';
          ctx.beginPath();
          ctx.arc(size / 2 - 2, btnY, 1.2, 0, Math.PI * 2);
          ctx.arc(size / 2 + 2, btnY, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Overshirt: structured yoke and dual chest pockets
      if (isOvershirt) {
        // Center placket
        const placketW = 50;
        const placketX = (size - placketW) / 2;
        ctx.fillStyle = '#22252F';
        ctx.fillRect(placketX, 0, placketW, size);
        ctx.strokeStyle = '#3E4455';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(placketX, 0, placketW, size);

        // Flap pockets
        ctx.fillStyle = '#2A2E3B';
        ctx.fillRect(50, 160, 120, 140);
        ctx.strokeRect(50, 160, 120, 140);
        ctx.fillRect(size - 170, 160, 120, 140);
        ctx.strokeRect(size - 170, 160, 120, 140);
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
   * 1. 3D Torso Mesh: Creates an anatomically curved hollow cylinder encasing chest, pecs, ribs, spine & waist
   */
  private createVolumetricTorsoGeometry(
    garmentWidth: number,
    garmentHeight: number,
    chestDepth: number
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const radialSegments = 36;
    const heightSegments = 32;

    const rx = garmentWidth * 0.46; // Transverse radius (half-width)
    const rz = chestDepth;          // Anteroposterior radius (3D depth)

    for (let j = 0; j <= heightSegments; j++) {
      const v = j / heightSegments; // 0 at collar, 1 at hem
      const y = -v * garmentHeight; // Collar notch is origin y=0

      // Anatomical torso silhouette: broad shoulders, tapers at waist, subtle hip flare
      let widthScale = 1.0;
      if (v < 0.20) {
        widthScale = 1.0 + (1.0 - v / 0.20) * 0.10;
      } else if (v > 0.75) {
        widthScale = 0.94 + ((v - 0.75) / 0.25) * 0.08;
      } else {
        widthScale = 0.93; // Athletic natural waist taper
      }

      for (let i = 0; i <= radialSegments; i++) {
        // 0 is front-center, PI/2 is right rib, PI is spine, 3PI/2 is left rib
        const theta = (i / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        let x = rx * widthScale * sinT;
        let z = rz * cosT;
        let yOffset = 0;

        const isFront = cosT >= 0;

        if (isFront) {
          // Pectoral / Chest projection (+Z)
          if (v > 0.12 && v < 0.52) {
            const pecFactor = Math.sin(((v - 0.12) / 0.40) * Math.PI);
            z += rz * 0.38 * pecFactor * cosT;
          }
          // Front collar scoop around suprasternal notch
          if (v < 0.15 && Math.abs(sinT) < 0.40) {
            const scoop = Math.cos((sinT / 0.40) * (Math.PI / 2));
            yOffset -= (1.0 - v / 0.15) * (garmentHeight * 0.08) * scoop;
            z -= (1.0 - v / 0.15) * (rz * 0.20) * scoop;
          }
        } else {
          // Back panel: spine curvature
          z *= 0.82;
          if (v < 0.10) {
            yOffset += (1.0 - v / 0.10) * (garmentHeight * 0.03);
          }
        }

        positions.push(x, y + yOffset, z);

        // UV mapping
        let uMap: number;
        if (isFront) {
          uMap = (sinT + 1) / 2;
        } else {
          uMap = (-sinT + 1) / 2;
        }
        uvs.push(uMap, 1.0 - v);
      }
    }

    // Build index buffer for 360-degree tubular mesh
    for (let j = 0; j < heightSegments; j++) {
      for (let i = 0; i < radialSegments; i++) {
        const a = j * (radialSegments + 1) + i;
        const b = (j + 1) * (radialSegments + 1) + i;
        const c = (j + 1) * (radialSegments + 1) + (i + 1);
        const d = j * (radialSegments + 1) + (i + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * 2. 3D Sleeve Geometry: Creates a hollow tapered cylinder for the arms
   */
  private createSleeveGeometry(
    shoulderRadius: number,
    cuffRadius: number,
    length: number
  ): THREE.BufferGeometry {
    const radialSegments = 24;
    const heightSegments = 16;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= heightSegments; j++) {
      const v = j / heightSegments; // 0 at shoulder, 1 at sleeve cuff
      const y = -v * length;        // Extends down arm
      const currentRadius = shoulderRadius * (1.0 - v) + cuffRadius * v;

      for (let i = 0; i <= radialSegments; i++) {
        const theta = (i / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const x = currentRadius * cosT;
        const z = currentRadius * 0.88 * sinT; // Subtle oval cross-section of arm

        positions.push(x, y, z);
        uvs.push(i / radialSegments, 1.0 - v);
      }
    }

    for (let j = 0; j < heightSegments; j++) {
      for (let i = 0; i < radialSegments; i++) {
        const a = j * (radialSegments + 1) + i;
        const b = (j + 1) * (radialSegments + 1) + i;
        const c = (j + 1) * (radialSegments + 1) + (i + 1);
        const d = j * (radialSegments + 1) + (i + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * 3. 3D Collar Ring Geometry: Frames the neckline with realistic ribbing / collar stand
   */
  private createCollarGeometry(
    radiusX: number,
    radiusZ: number,
    thickness: number
  ): THREE.BufferGeometry {
    const segments = 32;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Inner ring point
      const xIn = radiusX * sinT;
      const zIn = radiusZ * cosT;
      const yIn = cosT >= 0 ? -12 * (1.0 - Math.abs(sinT)) : 4;

      // Outer ribbing point
      const xOut = (radiusX + thickness) * sinT;
      const zOut = (radiusZ + thickness * 0.7) * cosT;
      const yOut = yIn + 3;

      positions.push(xIn, yIn, zIn);
      uvs.push(i / segments, 0);

      positions.push(xOut, yOut, zOut);
      uvs.push(i / segments, 1);
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2 + 1;
      const d = (i + 1) * 2;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * 4. 3D Chest Graphic Patch: Maps custom graphics / prints directly on chest curvature
   */
  private createChestGraphicGeometry(
    width: number,
    height: number,
    chestDepth: number
  ): THREE.BufferGeometry {
    const segmentsX = 16;
    const segmentsY = 16;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= segmentsY; j++) {
      const v = j / segmentsY;
      const y = -height * 0.22 - v * height * 0.55;

      for (let i = 0; i <= segmentsX; i++) {
        const u = i / segmentsX;
        const x = (u - 0.5) * width * 0.65;

        // Curve with chest curvature (+1.5px Z-offset to avoid z-fighting)
        const curveFactor = 1.0 - Math.pow(x / (width * 0.40), 2);
        const z = chestDepth * 0.95 + Math.max(0, curveFactor) * (chestDepth * 0.35) + 1.5;

        positions.push(x, y, z);
        uvs.push(u, 1.0 - v);
      }
    }

    for (let j = 0; j < segmentsY; j++) {
      for (let i = 0; i < segmentsX; i++) {
        const a = j * (segmentsX + 1) + i;
        const b = (j + 1) * (segmentsX + 1) + i;
        const c = (j + 1) * (segmentsX + 1) + (i + 1);
        const d = j * (segmentsX + 1) + (i + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Main 3D Render Loop: Solves multi-part skeletal kinematics and renders true 3D garment
   */
  public render3DGarment(
    canvasWidth: number,
    canvasHeight: number,
    kp: PoseKeypoints,
    garment: GarmentItem,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options: GarmentRenderOptions
  ): HTMLCanvasElement | null {
    if (!this.renderer || !this.scene || !this.camera || !this.pivotGroup) return null;

    this.resize(canvasWidth, canvasHeight);

    // Screen-space shoulder positions
    const shLeft = kp.leftShoulder.x <= kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;
    const shRight = kp.leftShoulder.x > kp.rightShoulder.x ? kp.leftShoulder : kp.rightShoulder;

    const shLeftX = shLeft.x * canvasWidth;
    const shLeftY = shLeft.y * canvasHeight;
    const shRightX = shRight.x * canvasWidth;
    const shRightY = shRight.y * canvasHeight;

    const dx = shRightX - shLeftX;
    const dy = shRightY - shLeftY;
    const shoulderSpan = Math.hypot(dx, dy);

    // Shoulder roll angle
    const rawAngle = Math.atan2(dy, dx);
    const maxTilt = (35 * Math.PI) / 180;
    const rollAngle = Math.max(-maxTilt, Math.min(maxTilt, rawAngle));

    // True 3D Yaw Rotation from landmarks (when user turns their body)
    const bodyYaw = (kp.rightShoulder.z || 0) - (kp.leftShoulder.z || 0);
    const isFacingBack = !kp.nose || (kp.nose.visibility !== undefined && kp.nose.visibility < 0.25);
    let yawAngle = Math.max(-0.75, Math.min(0.75, bodyYaw * 2.5));
    if (isFacingBack) {
      yawAngle += Math.PI;
    }

    // 3D Pitch (leaning)
    const spineDz = (kp.midHip.z || 0) - (kp.neckBase.z || 0);
    const pitchAngle = Math.max(-0.3, Math.min(0.3, spineDz * 1.2));

    const shMidX = (shLeftX + shRightX) / 2;
    const shMidY = (shLeftY + shRightY) / 2;

    // Upward perpendicular unit vector from shoulder line towards head
    const upX = Math.sin(rollAngle);
    const upY = -Math.cos(rollAngle);

    // Suprasternal notch collar position
    const neckElev = shoulderSpan * 0.08;
    const collarCanvasX = shMidX + upX * neckElev;
    const collarCanvasY = shMidY + upY * neckElev + (garment.offsetYFactor || 0) * canvasHeight;

    // Physical garment sizing
    const shoulderRatio = garment.shoulderSpanRatio || 0.68;
    const garmentWidth = (shoulderSpan / shoulderRatio) * (garment.scaleFactor || 1.0) * options.sizeMultiplier;

    // Anatomical torso distance down past beltline/hips
    const neckToHipSpan = Math.hypot(
      (kp.midHip.x - kp.neckBase.x) * canvasWidth,
      (kp.midHip.y - kp.neckBase.y) * canvasHeight
    );
    const baseAspectHeight = garmentWidth / garment.aspectRatio;
    const anatomicalTorsoHeight = neckToHipSpan * 1.25 * options.sizeMultiplier;
    const garmentHeight = Math.max(baseAspectHeight, anatomicalTorsoHeight);

    // Three.js coordinates (origin at center)
    const threeCollarX = collarCanvasX - canvasWidth / 2;
    const threeCollarY = canvasHeight / 2 - collarCanvasY;

    // 3D Depth proportional to biacromial diameter
    const chestDepth = Math.max(48, Math.min(120, shoulderSpan * 0.35));

    // Get PBR textures: procedural fabric diffuse + procedural cloth weave normal map
    const fabricDiffuse = this.generateFabricDiffuseTexture(garment);
    const normalMap = this.fabricNormalTexture;

    const fabricMaterial = new THREE.MeshStandardMaterial({
      map: fabricDiffuse,
      normalMap: normalMap || undefined,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: options.opacity,
      wireframe: options.wireframeOnly
    });

    // -------------------------------------------------------------
    // 1. Build / Update 3D Torso Mesh
    // -------------------------------------------------------------
    if (this.torsoMesh) {
      this.pivotGroup.remove(this.torsoMesh);
      this.torsoMesh.geometry.dispose();
      this.torsoMesh = null;
    }
    const torsoGeom = this.createVolumetricTorsoGeometry(garmentWidth, garmentHeight, chestDepth);
    this.torsoMesh = new THREE.Mesh(torsoGeom, fabricMaterial);
    this.pivotGroup.add(this.torsoMesh);

    // -------------------------------------------------------------
    // 2. Build / Update 3D Collar Ring Mesh
    // -------------------------------------------------------------
    if (this.collarMesh) {
      this.pivotGroup.remove(this.collarMesh);
      this.collarMesh.geometry.dispose();
      this.collarMesh = null;
    }
    const collarGeom = this.createCollarGeometry(garmentWidth * 0.18, chestDepth * 0.65, garmentWidth * 0.035);
    this.collarMesh = new THREE.Mesh(collarGeom, fabricMaterial);
    this.pivotGroup.add(this.collarMesh);

    // -------------------------------------------------------------
    // 5. Global Pivot Positioning & 3D Pose Rotation
    // -------------------------------------------------------------
    this.pivotGroup.position.set(threeCollarX, threeCollarY, 0);
    this.pivotGroup.rotation.order = 'ZYX';
    this.pivotGroup.rotation.z = -rollAngle;  // Roll (shoulder tilt)
    this.pivotGroup.rotation.y = yawAngle;    // Yaw (body turn in 3D)
    this.pivotGroup.rotation.x = -pitchAngle; // Pitch (leaning forward/backward)

    // Pre-calculate inverse rotation of pivot group for local sleeve alignment
    const pivotInvQuat = this.pivotGroup.quaternion.clone().invert();

    // -------------------------------------------------------------
    // 3. Dynamic 3D Left & Right Sleeves (Arm Kinematics)
    // -------------------------------------------------------------
    const sleeveTopRadius = shoulderSpan * 0.19;
    const sleeveCuffRadius = shoulderSpan * 0.15;
    const isLongSleeve = garment.category === 'outerwear';
    const sleeveLength = (shoulderSpan * 0.72) * (isLongSleeve ? 1.45 : 0.85);

    // Screen-left arm
    const isShLeftKpLeft = kp.leftShoulder.x <= kp.rightShoulder.x;
    const elbowScreenLeft = isShLeftKpLeft ? kp.leftElbow : kp.rightElbow;
    const elbowScreenRight = isShLeftKpLeft ? kp.rightElbow : kp.leftElbow;

    // --- Screen-Left Sleeve Kinematics ---
    if (this.leftSleeveMesh) {
      this.pivotGroup.remove(this.leftSleeveMesh);
      this.leftSleeveMesh.geometry.dispose();
      this.leftSleeveMesh = null;
    }
    const leftSleeveGeom = this.createSleeveGeometry(sleeveTopRadius, sleeveCuffRadius, sleeveLength);
    this.leftSleeveMesh = new THREE.Mesh(leftSleeveGeom, fabricMaterial);

    const leftShoulderLocalX = -garmentWidth * 0.43;
    const leftShoulderLocalY = -garmentHeight * 0.05;
    this.leftSleeveMesh.position.set(leftShoulderLocalX, leftShoulderLocalY, 0);

    let worldLeftArmDir = new THREE.Vector3(-0.38, -0.92, 0.06).normalize();
    if (elbowScreenLeft && elbowScreenLeft.visibility && elbowScreenLeft.visibility > 0.35) {
      const dxArm = (elbowScreenLeft.x - shLeft.x) * canvasWidth;
      const dyArm = -(elbowScreenLeft.y - shLeft.y) * canvasHeight; // Inverted: Three.js Y is up
      const dzArm = -((elbowScreenLeft.z || 0) - (shLeft.z || 0)) * canvasWidth * 0.5;
      const detected = new THREE.Vector3(dxArm, dyArm, dzArm);
      if (detected.lengthSq() > 100) {
        worldLeftArmDir = detected.normalize();
      }
    }
    const localLeftArmDir = worldLeftArmDir.applyQuaternion(pivotInvQuat).normalize();
    this.leftSleeveMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localLeftArmDir);
    this.pivotGroup.add(this.leftSleeveMesh);

    // --- Screen-Right Sleeve Kinematics ---
    if (this.rightSleeveMesh) {
      this.pivotGroup.remove(this.rightSleeveMesh);
      this.rightSleeveMesh.geometry.dispose();
      this.rightSleeveMesh = null;
    }
    const rightSleeveGeom = this.createSleeveGeometry(sleeveTopRadius, sleeveCuffRadius, sleeveLength);
    this.rightSleeveMesh = new THREE.Mesh(rightSleeveGeom, fabricMaterial);

    const rightShoulderLocalX = garmentWidth * 0.43;
    const rightShoulderLocalY = -garmentHeight * 0.05;
    this.rightSleeveMesh.position.set(rightShoulderLocalX, rightShoulderLocalY, 0);

    let worldRightArmDir = new THREE.Vector3(0.38, -0.92, 0.06).normalize();
    if (elbowScreenRight && elbowScreenRight.visibility && elbowScreenRight.visibility > 0.35) {
      const dxArm = (elbowScreenRight.x - shRight.x) * canvasWidth;
      const dyArm = -(elbowScreenRight.y - shRight.y) * canvasHeight;
      const dzArm = -((elbowScreenRight.z || 0) - (shRight.z || 0)) * canvasWidth * 0.5;
      const detected = new THREE.Vector3(dxArm, dyArm, dzArm);
      if (detected.lengthSq() > 100) {
        worldRightArmDir = detected.normalize();
      }
    }
    const localRightArmDir = worldRightArmDir.applyQuaternion(pivotInvQuat).normalize();
    this.rightSleeveMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localRightArmDir);
    this.pivotGroup.add(this.rightSleeveMesh);

    // -------------------------------------------------------------
    // 4. Custom Chest Print / Uploaded Graphic Overlay (if applicable)
    // -------------------------------------------------------------
    if (garment.id.startsWith('custom-') || garment.imageUrl.startsWith('blob:')) {
      if (this.chestGraphicMesh) {
        this.pivotGroup.remove(this.chestGraphicMesh);
        this.chestGraphicMesh.geometry.dispose();
        this.chestGraphicMesh = null;
      }
      const customTex = this.getTexture(garment.imageUrl, imageSource);
      customTex.needsUpdate = true;

      const chestPatchGeom = this.createChestGraphicGeometry(garmentWidth, garmentHeight, chestDepth);
      const chestPatchMat = new THREE.MeshBasicMaterial({
        map: customTex,
        transparent: true,
        opacity: options.opacity,
        depthWrite: false
      });
      this.chestGraphicMesh = new THREE.Mesh(chestPatchGeom, chestPatchMat);
      this.pivotGroup.add(this.chestGraphicMesh);
    } else if (this.chestGraphicMesh) {
      this.pivotGroup.remove(this.chestGraphicMesh);
      this.chestGraphicMesh.geometry.dispose();
      this.chestGraphicMesh = null;
    }

    // Dynamic key light follows yaw for dramatic 3D highlights
    if (this.keyLight) {
      this.keyLight.position.set(0.3 + yawAngle * 0.6, 1.0, 1.5).normalize();
    }

    // Render WebGL Scene
    this.renderer.render(this.scene, this.camera);

    return this.renderer.domElement;
  }
}

export const threeGarmentEngine = new ThreeGarmentEngine();

