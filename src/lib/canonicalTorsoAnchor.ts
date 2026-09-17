import * as THREE from 'three';
import { solveProcrustes } from './procrustesSolver';
import { OneEuroFilter, OneEuroVector3Filter, OneEuroQuaternionFilter } from './landmarkSmoothing';

export interface TrackedLandmarksInput {
  leftShoulder: THREE.Vector3;
  rightShoulder: THREE.Vector3;
  neckBase: THREE.Vector3;
  leftHip: THREE.Vector3;
  rightHip: THREE.Vector3;
  midHip: THREE.Vector3;
  chestMid: THREE.Vector3;
}

/**
 * Production-Grade Canonical Torso Anchor & Occluder System
 * Adopts the standard Spark AR / Snap Lens Studio / Messenger filter hierarchy:
 * 1. An invisible canonical reference torso defines standard human upper-body geometry.
 * 2. An invisible 3D neck and torso occluder writes to the Z-buffer (depthWrite: true, colorWrite: false).
 * 3. The 3D garment is mounted as a static child at (0, 0, 0).
 * 4. A closed-form Procrustes (SVD) solver directly computes the optimal Matrix4 per frame.
 */
export class CanonicalTorsoAnchor {
  public readonly group: THREE.Group;
  private occluderGroup: THREE.Group;
  private garmentContainer: THREE.Group;

  // Canonical Reference Points (Standard Human Torso in Meters)
  // Origin (0, 0, 0) sits at the suprasternal collar notch
  public readonly canonicalPoints: THREE.Vector3[] = [
    new THREE.Vector3(-0.19, -0.03, 0.0),    // 0: Left Shoulder
    new THREE.Vector3(0.19, -0.03, 0.0),     // 1: Right Shoulder
    new THREE.Vector3(0.0, 0.0, 0.0),        // 2: Suprasternal Collar Notch
    new THREE.Vector3(-0.13, -0.50, 0.0),    // 3: Left Hip
    new THREE.Vector3(0.13, -0.50, 0.0),     // 4: Right Hip
    new THREE.Vector3(0.0, -0.50, 0.0),      // 5: Mid-Hip
    new THREE.Vector3(0.0, -0.15, 0.04)      // 6: Mid-Chest
  ];

  // 1-Euro Filters for Jitter-Free Tracking & Responsive Motion
  private posFilter = new OneEuroVector3Filter(1.2, 0.015);
  private rotFilter = new OneEuroQuaternionFilter(1.0, 0.018);
  private scaleFilter = new OneEuroFilter(1.0, 0.008);

  private isInitialized = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CanonicalTorsoAnchor';
    // Matrix is driven manually by Procrustes SVD matrix
    this.group.matrixAutoUpdate = false;

    this.occluderGroup = new THREE.Group();
    this.occluderGroup.name = 'TorsoOccluderGroup';

    this.garmentContainer = new THREE.Group();
    this.garmentContainer.name = 'GarmentContainer';

    this.group.add(this.occluderGroup);
    this.group.add(this.garmentContainer);

    this.build3DOccluders();
  }

  /**
   * Constructs the invisible 3D neck and chin geometric occluders
   * ColorWrite: false -> Invisible on screen
   * DepthWrite: true  -> Writes to WebGL Z-buffer before garment renders
   * 
   * Sized precisely so they sit inside the collar opening and chin without
   * penetrating the front fabric of the shirt.
   */
  private build3DOccluders(): void {
    const occluderMat = new THREE.MeshBasicMaterial({
      colorWrite: false, // Does not write RGB pixels
      depthWrite: true,  // Writes to depth buffer
      depthTest: true,
      side: THREE.DoubleSide
    });

    // 1. Anatomical Neck Cylinder (frames the collar opening)
    // Sized to fit comfortably inside the collar opening (collar opening r ~ 0.08 - 0.11m)
    const neckRadius = 0.062;
    const neckHeight = 0.24;
    const neckGeom = new THREE.CylinderGeometry(neckRadius * 0.95, neckRadius, neckHeight, 24);
    // Extends from collar notch (y=0) upward to y=0.24
    neckGeom.translate(0, neckHeight / 2, -0.015);
    const neckMesh = new THREE.Mesh(neckGeom, occluderMat);
    neckMesh.renderOrder = -1; // Must render before garment!
    this.occluderGroup.add(neckMesh);

    // 2. Chin & Jaw Capsule / Sphere
    const chinRadius = 0.075;
    const chinGeom = new THREE.SphereGeometry(chinRadius, 20, 16);
    chinGeom.scale(1.0, 1.1, 1.15);
    chinGeom.translate(0, 0.19, 0.02);
    const chinMesh = new THREE.Mesh(chinGeom, occluderMat);
    chinMesh.renderOrder = -1;
    this.occluderGroup.add(chinMesh);

    // NOTE: Internal torso core occluder is omitted because the 3D shirt is an opaque
    // mesh with depthTest enabled. An internal cylinder causes the chest to penetrate
    // and carve holes through the front fabric.
  }

  /**
   * Mounts a 3D garment object as a static child of the anchor
   */
  public attachGarment(garmentObject: THREE.Object3D): void {
    // Clear previous garment
    while (this.garmentContainer.children.length > 0) {
      this.garmentContainer.remove(this.garmentContainer.children[0]);
    }
    garmentObject.position.set(0, 0, 0);
    this.garmentContainer.add(garmentObject);
  }

  public getGarmentContainer(): THREE.Group {
    return this.garmentContainer;
  }

  /**
   * Solves the optimal Procrustes Matrix4 from live tracked landmarks
   * and updates the anchor matrix with 1-Euro temporal smoothing
   */
  public update(tracked: TrackedLandmarksInput, timestampMs: number): THREE.Matrix4 {
    const targetPoints: THREE.Vector3[] = [
      tracked.leftShoulder,
      tracked.rightShoulder,
      tracked.neckBase,
      tracked.leftHip,
      tracked.rightHip,
      tracked.midHip,
      tracked.chestMid
    ];

    // Closed-form Umeyama / Kabsch SVD Procrustes alignment
    const result = solveProcrustes(this.canonicalPoints, targetPoints);

    if (!this.isInitialized) {
      this.isInitialized = true;
      this.posFilter.filter(result.translation, timestampMs);
      this.rotFilter.filter(result.rotation, timestampMs);
      this.scaleFilter.filter(result.scale, timestampMs);
      this.group.position.copy(result.translation);
      this.group.quaternion.copy(result.rotation);
      this.group.scale.set(result.scale, result.scale, result.scale);
      this.group.matrix.copy(result.matrix);
      this.group.matrixWorldNeedsUpdate = true;
      return this.group.matrix;
    }

    // 1-Euro Temporal Jitter Filtering
    const smoothTranslation = this.posFilter.filter(result.translation, timestampMs);
    const smoothRotation = this.rotFilter.filter(result.rotation, timestampMs);
    const smoothScale = this.scaleFilter.filter(result.scale, timestampMs);

    // Reconstruct Final World Matrix & keep position/quaternion/scale synchronized
    this.group.position.copy(smoothTranslation);
    this.group.quaternion.copy(smoothRotation);
    this.group.scale.set(smoothScale, smoothScale, smoothScale);
    this.group.matrix.compose(
      smoothTranslation,
      smoothRotation,
      new THREE.Vector3(smoothScale, smoothScale, smoothScale)
    );
    this.group.matrixWorldNeedsUpdate = true;

    return this.group.matrix;
  }

  public reset(): void {
    this.posFilter.reset();
    this.rotFilter.reset();
    this.scaleFilter.reset();
    this.isInitialized = false;
  }
}
