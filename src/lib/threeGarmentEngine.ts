import * as THREE from 'three';
import { PoseKeypoints, GarmentItem, GarmentRenderOptions } from './types';

export class ThreeGarmentEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private pivotGroup: THREE.Group | null = null;

  // Multi-part 3D garment mesh components (Tops)
  private torsoMesh: THREE.Mesh | null = null;
  private leftSleeveMesh: THREE.Mesh | null = null;
  private rightSleeveMesh: THREE.Mesh | null = null;
  private leftShoulderCapMesh: THREE.Mesh | null = null;
  private rightShoulderCapMesh: THREE.Mesh | null = null;
  private collarMesh: THREE.Mesh | null = null;
  private chestGraphicMesh: THREE.Mesh | null = null;

  // Multi-part 3D garment mesh components (Bottoms / Pants)
  private pantsWaistMesh: THREE.Mesh | null = null;
  private pantsLeftThighMesh: THREE.Mesh | null = null;
  private pantsRightThighMesh: THREE.Mesh | null = null;
  private pantsLeftCalfMesh: THREE.Mesh | null = null;
  private pantsRightCalfMesh: THREE.Mesh | null = null;

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

    // Initialize procedural cloth normal maps
    this.fabricNormalTexture = this.generateProceduralNormalMap();
    this.denimNormalTexture = this.generateDenimNormalMap();
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

          // Diagonal twill ridge (2x1 or 3x1 twill diagonal lines)
          const twillLine = Math.sin((x + y) * 0.8) * 18;
          const grain = (Math.random() - 0.5) * 8;

          // Leg vertical tension creases
          const legCrease = Math.sin(x * 0.05) * 8;

          const nx = Math.max(0, Math.min(255, 128 + twillLine + grain));
          const ny = Math.max(0, Math.min(255, 128 - twillLine + legCrease));
          const nz = 240;

          data[idx] = nx;
          data[idx + 1] = ny;
          data[idx + 2] = nz;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 10);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
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
      let baseColor = '#FFFFFF';
      let secondaryColor = '#E9ECEF';
      let isOxford = false;
      let isOvershirt = false;

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

        // Waistband line & central crease / fly
        ctx.strokeStyle = isDenim ? '#B87333' : '#333744';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, size, 40);
        ctx.beginPath();
        ctx.moveTo(size / 2, 40);
        ctx.lineTo(size / 2, size);
        ctx.stroke();
      } else if (garment.id.includes('tee') || garment.name.toLowerCase().includes('tee')) {
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

      if (!isBottoms) {
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
   * 5. 3D Shoulder Cap (Deltoid Bridge): Smooth joint transition bridging armscye to sleeve
   */
  private createShoulderCapGeometry(radius: number): THREE.BufferGeometry {
    const radialSegments = 24;
    const heightSegments = 12;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= heightSegments; j++) {
      const v = j / heightSegments;
      const phi = v * (Math.PI * 0.55); // Hemisphere dome capping the joint
      const r = radius * Math.sin(phi);
      const y = -radius * (1.0 - Math.cos(phi)) * 0.8;

      for (let i = 0; i <= radialSegments; i++) {
        const theta = (i / radialSegments) * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * 0.9 * Math.sin(theta);

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
   * 6. 3D Pants Waistband Geometry: Volumetric hollow cylinder around pelvis and hips
   */
  private createPantsWaistGeometry(
    waistWidth: number,
    waistDepth: number,
    waistHeight: number
  ): THREE.BufferGeometry {
    const radialSegments = 32;
    const heightSegments = 14;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const rx = waistWidth * 0.48;
    const rz = waistDepth;

    for (let j = 0; j <= heightSegments; j++) {
      const v = j / heightSegments; // 0 at waistline, 1 at crotch
      const y = -v * waistHeight;
      // Slight widening over hips
      const scale = 1.0 + v * 0.08;

      for (let i = 0; i <= radialSegments; i++) {
        const theta = (i / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const x = rx * scale * sinT;
        let z = rz * scale * cosT;
        // Gluteal / seat projection in back (-Z)
        if (cosT < 0 && v > 0.3) {
          z -= rz * 0.25 * Math.sin(v * Math.PI) * Math.abs(cosT);
        }

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
   * 7. 3D Pants Leg Geometry: Tapered hollow cylinder along thigh / calf
   */
  private createPantsLegGeometry(
    topRadius: number,
    bottomRadius: number,
    length: number
  ): THREE.BufferGeometry {
    const radialSegments = 24;
    const heightSegments = 18;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= heightSegments; j++) {
      const v = j / heightSegments;
      const y = -v * length;
      const r = topRadius * (1.0 - v) + bottomRadius * v;

      for (let i = 0; i <= radialSegments; i++) {
        const theta = (i / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const x = r * sinT;
        const z = r * 0.95 * cosT;

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

    // -------------------------------------------------------------
    // Real-Time Environmental Light & Tone Matching Constraint
    // -------------------------------------------------------------
    if (options.environmentalLighting) {
      const { luminance, r, g, b } = options.environmentalLighting;
      if (this.ambientLight) {
        this.ambientLight.intensity = Math.max(0.38, Math.min(1.15, luminance * 1.15));
        this.ambientLight.color.setRGB(r, g, b);
      }
      if (this.keyLight) {
        this.keyLight.intensity = Math.max(0.48, Math.min(1.35, luminance * 1.30));
        this.keyLight.color.setRGB(
          Math.min(1, r * 1.05),
          Math.min(1, g * 1.05),
          Math.min(1, b * 1.05)
        );
      }
    }

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

    const isBottoms = garment.category === 'bottoms' || garment.id.includes('trouser') || garment.id.includes('denim');

    // =============================================================
    // BRANCH A: 3D PANTS / BOTTOMS KINEMATICS
    // =============================================================
    if (isBottoms) {
      // Remove any active tops meshes
      if (this.torsoMesh) {
        this.pivotGroup.remove(this.torsoMesh);
        this.torsoMesh.geometry.dispose();
        this.torsoMesh = null;
      }
      if (this.collarMesh) {
        this.pivotGroup.remove(this.collarMesh);
        this.collarMesh.geometry.dispose();
        this.collarMesh = null;
      }
      if (this.leftSleeveMesh) {
        this.pivotGroup.remove(this.leftSleeveMesh);
        this.leftSleeveMesh.geometry.dispose();
        this.leftSleeveMesh = null;
      }
      if (this.rightSleeveMesh) {
        this.pivotGroup.remove(this.rightSleeveMesh);
        this.rightSleeveMesh.geometry.dispose();
        this.rightSleeveMesh = null;
      }
      if (this.leftShoulderCapMesh) {
        this.pivotGroup.remove(this.leftShoulderCapMesh);
        this.leftShoulderCapMesh.geometry.dispose();
        this.leftShoulderCapMesh = null;
      }
      if (this.rightShoulderCapMesh) {
        this.pivotGroup.remove(this.rightShoulderCapMesh);
        this.rightShoulderCapMesh.geometry.dispose();
        this.rightShoulderCapMesh = null;
      }
      if (this.chestGraphicMesh) {
        this.pivotGroup.remove(this.chestGraphicMesh);
        this.chestGraphicMesh.geometry.dispose();
        this.chestGraphicMesh = null;
      }

      // Hip telemetry
      const hipLeft = kp.leftHip.x <= kp.rightHip.x ? kp.leftHip : kp.rightHip;
      const hipRight = kp.leftHip.x > kp.rightHip.x ? kp.leftHip : kp.rightHip;

      const hipLeftX = hipLeft.x * canvasWidth;
      const hipLeftY = hipLeft.y * canvasHeight;
      const hipRightX = hipRight.x * canvasWidth;
      const hipRightY = hipRight.y * canvasHeight;

      const hipDx = hipRightX - hipLeftX;
      const hipDy = hipRightY - hipLeftY;
      const hipSpan = Math.hypot(hipDx, hipDy);
      const hipTilt = Math.atan2(hipDy, hipDx);

      const midHipX = (hipLeftX + hipRightX) / 2;
      const midHipY = (hipLeftY + hipRightY) / 2;

      const threeHipX = midHipX - canvasWidth / 2;
      const threeHipY = canvasHeight / 2 - midHipY;

      const pantsWaistWidth = Math.max(140, hipSpan * 1.35 * options.sizeMultiplier);
      const pantsWaistDepth = Math.max(50, hipSpan * 0.46);
      const pantsWaistHeight = hipSpan * 0.42;

      const isDenim = garment.id.includes('denim');
      const pantsDiffuse = this.generateFabricDiffuseTexture(garment);
      const pantsNormal = isDenim ? this.denimNormalTexture : this.fabricNormalTexture;

      const pantsMaterial = new THREE.MeshStandardMaterial({
        map: pantsDiffuse,
        normalMap: pantsNormal || undefined,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: isDenim ? 0.88 : 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: options.opacity,
        wireframe: options.wireframeOnly
      });

      // 1. Waistband & Pelvis Encasement
      if (this.pantsWaistMesh) {
        this.pivotGroup.remove(this.pantsWaistMesh);
        this.pantsWaistMesh.geometry.dispose();
        this.pantsWaistMesh = null;
      }
      const waistGeom = this.createPantsWaistGeometry(pantsWaistWidth, pantsWaistDepth, pantsWaistHeight);
      this.pantsWaistMesh = new THREE.Mesh(waistGeom, pantsMaterial);
      this.pivotGroup.add(this.pantsWaistMesh);

      // Set Pivot at Waist Center
      this.pivotGroup.position.set(threeHipX, threeHipY, 0);
      this.pivotGroup.rotation.order = 'ZYX';
      this.pivotGroup.rotation.z = -hipTilt;
      this.pivotGroup.rotation.y = yawAngle * 0.75;
      this.pivotGroup.rotation.x = -pitchAngle * 0.8;

      const pivotInvQuat = this.pivotGroup.quaternion.clone().invert();

      // Leg geometry sizing
      const thighRadius = hipSpan * 0.28;
      const kneeRadius = hipSpan * 0.22;
      const ankleRadius = hipSpan * 0.18;
      const legLength = Math.max(180, canvasHeight * 0.42 * options.sizeMultiplier);
      const thighLength = legLength * 0.52;
      const calfLength = legLength * 0.48;

      // --- Left Leg (Thigh & Calf) ---
      if (this.pantsLeftThighMesh) {
        this.pivotGroup.remove(this.pantsLeftThighMesh);
        this.pantsLeftThighMesh.geometry.dispose();
        this.pantsLeftThighMesh = null;
      }
      const leftThighGeom = this.createPantsLegGeometry(thighRadius, kneeRadius, thighLength);
      this.pantsLeftThighMesh = new THREE.Mesh(leftThighGeom, pantsMaterial);
      const leftHipLocalX = -pantsWaistWidth * 0.26;
      const leftHipLocalY = -pantsWaistHeight * 0.95;
      this.pantsLeftThighMesh.position.set(leftHipLocalX, leftHipLocalY, 0);

      let worldLeftThighDir = new THREE.Vector3(-0.06, -0.99, 0.02).normalize();
      const kneeLeft = kp.leftHip.x <= kp.rightHip.x ? kp.leftKnee : kp.rightKnee;
      if (kneeLeft && kneeLeft.visibility && kneeLeft.visibility > 0.30) {
        const dxL = (kneeLeft.x - hipLeft.x) * canvasWidth;
        const dyL = -(kneeLeft.y - hipLeft.y) * canvasHeight;
        const dzL = -((kneeLeft.z || 0) - (hipLeft.z || 0)) * canvasWidth * 0.5;
        const v = new THREE.Vector3(dxL, dyL, dzL);
        if (v.lengthSq() > 100) worldLeftThighDir = v.normalize();
      }
      const localLeftThighDir = worldLeftThighDir.applyQuaternion(pivotInvQuat).normalize();
      this.pantsLeftThighMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localLeftThighDir);
      this.pivotGroup.add(this.pantsLeftThighMesh);

      // --- Right Leg (Thigh & Calf) ---
      if (this.pantsRightThighMesh) {
        this.pivotGroup.remove(this.pantsRightThighMesh);
        this.pantsRightThighMesh.geometry.dispose();
        this.pantsRightThighMesh = null;
      }
      const rightThighGeom = this.createPantsLegGeometry(thighRadius, kneeRadius, thighLength);
      this.pantsRightThighMesh = new THREE.Mesh(rightThighGeom, pantsMaterial);
      const rightHipLocalX = pantsWaistWidth * 0.26;
      const rightHipLocalY = -pantsWaistHeight * 0.95;
      this.pantsRightThighMesh.position.set(rightHipLocalX, rightHipLocalY, 0);

      let worldRightThighDir = new THREE.Vector3(0.06, -0.99, 0.02).normalize();
      const kneeRight = kp.leftHip.x > kp.rightHip.x ? kp.leftKnee : kp.rightKnee;
      if (kneeRight && kneeRight.visibility && kneeRight.visibility > 0.30) {
        const dxR = (kneeRight.x - hipRight.x) * canvasWidth;
        const dyR = -(kneeRight.y - hipRight.y) * canvasHeight;
        const dzR = -((kneeRight.z || 0) - (hipRight.z || 0)) * canvasWidth * 0.5;
        const v = new THREE.Vector3(dxR, dyR, dzR);
        if (v.lengthSq() > 100) worldRightThighDir = v.normalize();
      }
      const localRightThighDir = worldRightThighDir.applyQuaternion(pivotInvQuat).normalize();
      this.pantsRightThighMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localRightThighDir);
      this.pivotGroup.add(this.pantsRightThighMesh);

      // Render WebGL Scene
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement;
    }

    // =============================================================
    // BRANCH B: 3D TOPS / SHIRTS KINEMATICS & JOINT BRIDGING
    // =============================================================
    // Remove any active pants meshes
    if (this.pantsWaistMesh) {
      this.pivotGroup.remove(this.pantsWaistMesh);
      this.pantsWaistMesh.geometry.dispose();
      this.pantsWaistMesh = null;
    }
    if (this.pantsLeftThighMesh) {
      this.pivotGroup.remove(this.pantsLeftThighMesh);
      this.pantsLeftThighMesh.geometry.dispose();
      this.pantsLeftThighMesh = null;
    }
    if (this.pantsRightThighMesh) {
      this.pivotGroup.remove(this.pantsRightThighMesh);
      this.pantsRightThighMesh.geometry.dispose();
      this.pantsRightThighMesh = null;
    }

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

    // 1. Build / Update 3D Torso Mesh
    if (this.torsoMesh) {
      this.pivotGroup.remove(this.torsoMesh);
      this.torsoMesh.geometry.dispose();
      this.torsoMesh = null;
    }
    const torsoGeom = this.createVolumetricTorsoGeometry(garmentWidth, garmentHeight, chestDepth);
    this.torsoMesh = new THREE.Mesh(torsoGeom, fabricMaterial);
    this.pivotGroup.add(this.torsoMesh);

    // 2. Build / Update 3D Collar Ring Mesh
    if (this.collarMesh) {
      this.pivotGroup.remove(this.collarMesh);
      this.collarMesh.geometry.dispose();
      this.collarMesh = null;
    }
    const collarGeom = this.createCollarGeometry(garmentWidth * 0.18, chestDepth * 0.65, garmentWidth * 0.035);
    this.collarMesh = new THREE.Mesh(collarGeom, fabricMaterial);
    this.pivotGroup.add(this.collarMesh);

    // Set Global Pivot Positioning & 3D Pose Rotation
    this.pivotGroup.position.set(threeCollarX, threeCollarY, 0);
    this.pivotGroup.rotation.order = 'ZYX';
    this.pivotGroup.rotation.z = -rollAngle;  // Roll (shoulder tilt)
    this.pivotGroup.rotation.y = yawAngle;    // Yaw (body turn in 3D)
    this.pivotGroup.rotation.x = -pitchAngle; // Pitch (leaning forward/backward)

    const pivotInvQuat = this.pivotGroup.quaternion.clone().invert();

    // 3. Dynamic 3D Left & Right Sleeves with Deltoid Joint Bridging
    const sleeveTopRadius = shoulderSpan * 0.19;
    const sleeveCuffRadius = shoulderSpan * 0.15;
    const isLongSleeve = garment.category === 'outerwear';
    const sleeveLength = (shoulderSpan * 0.72) * (isLongSleeve ? 1.45 : 0.85);

    const isShLeftKpLeft = kp.leftShoulder.x <= kp.rightShoulder.x;
    const elbowScreenLeft = isShLeftKpLeft ? kp.leftElbow : kp.rightElbow;
    const elbowScreenRight = isShLeftKpLeft ? kp.rightElbow : kp.leftElbow;

    // --- Screen-Left Shoulder Cap (Deltoid Bridge) ---
    if (this.leftShoulderCapMesh) {
      this.pivotGroup.remove(this.leftShoulderCapMesh);
      this.leftShoulderCapMesh.geometry.dispose();
      this.leftShoulderCapMesh = null;
    }
    const leftCapGeom = this.createShoulderCapGeometry(sleeveTopRadius * 1.05);
    this.leftShoulderCapMesh = new THREE.Mesh(leftCapGeom, fabricMaterial);
    const leftShoulderLocalX = -garmentWidth * 0.43;
    const leftShoulderLocalY = -garmentHeight * 0.05;
    this.leftShoulderCapMesh.position.set(leftShoulderLocalX, leftShoulderLocalY, 0);
    this.pivotGroup.add(this.leftShoulderCapMesh);

    // --- Screen-Left Sleeve ---
    if (this.leftSleeveMesh) {
      this.pivotGroup.remove(this.leftSleeveMesh);
      this.leftSleeveMesh.geometry.dispose();
      this.leftSleeveMesh = null;
    }
    const leftSleeveGeom = this.createSleeveGeometry(sleeveTopRadius, sleeveCuffRadius, sleeveLength);
    this.leftSleeveMesh = new THREE.Mesh(leftSleeveGeom, fabricMaterial);
    this.leftSleeveMesh.position.set(leftShoulderLocalX, leftShoulderLocalY, 0);

    let worldLeftArmDir = new THREE.Vector3(-0.38, -0.92, 0.06).normalize();
    if (elbowScreenLeft && elbowScreenLeft.visibility && elbowScreenLeft.visibility > 0.35) {
      const dxArm = (elbowScreenLeft.x - shLeft.x) * canvasWidth;
      const dyArm = -(elbowScreenLeft.y - shLeft.y) * canvasHeight;
      const dzArm = -((elbowScreenLeft.z || 0) - (shLeft.z || 0)) * canvasWidth * 0.5;
      const detected = new THREE.Vector3(dxArm, dyArm, dzArm);
      if (detected.lengthSq() > 100) {
        worldLeftArmDir = detected.normalize();
      }
    }
    const localLeftArmDir = worldLeftArmDir.applyQuaternion(pivotInvQuat).normalize();
    this.leftSleeveMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localLeftArmDir);
    this.pivotGroup.add(this.leftSleeveMesh);

    // --- Screen-Right Shoulder Cap (Deltoid Bridge) ---
    if (this.rightShoulderCapMesh) {
      this.pivotGroup.remove(this.rightShoulderCapMesh);
      this.rightShoulderCapMesh.geometry.dispose();
      this.rightShoulderCapMesh = null;
    }
    const rightCapGeom = this.createShoulderCapGeometry(sleeveTopRadius * 1.05);
    this.rightShoulderCapMesh = new THREE.Mesh(rightCapGeom, fabricMaterial);
    const rightShoulderLocalX = garmentWidth * 0.43;
    const rightShoulderLocalY = -garmentHeight * 0.05;
    this.rightShoulderCapMesh.position.set(rightShoulderLocalX, rightShoulderLocalY, 0);
    this.pivotGroup.add(this.rightShoulderCapMesh);

    // --- Screen-Right Sleeve ---
    if (this.rightSleeveMesh) {
      this.pivotGroup.remove(this.rightSleeveMesh);
      this.rightSleeveMesh.geometry.dispose();
      this.rightSleeveMesh = null;
    }
    const rightSleeveGeom = this.createSleeveGeometry(sleeveTopRadius, sleeveCuffRadius, sleeveLength);
    this.rightSleeveMesh = new THREE.Mesh(rightSleeveGeom, fabricMaterial);
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

    // 4. Custom Chest Print / Uploaded Graphic Overlay (if applicable)
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

