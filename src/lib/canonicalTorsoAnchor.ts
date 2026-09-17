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
    new THREE.Vector3(-0.19, -0.04, 0.0),    // 0: Left Shoulder
    new THREE.Vector3(0.19, -0.04, 0.0),     // 1: Right Shoulder
    new THREE.Vector3(0.0, 0.0, 0.0),        // 2: Suprasternal Collar Notch
    new THREE.Vector3(-0.13, -0.52, 0.0),    // 3: Left Hip
    new THREE.Vector3(0.13, -0.52, 0.0),     // 4: Right Hip
    new THREE.Vector3(0.0, -0.52, 0.0),      // 5: Mid-Hip
    new THREE.Vector3(0.0, -0.16, 0.04)      // 6: Mid-Chest
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
   * Constructs the invisible 3D neck and head geometric occluders
   * ColorWrite: false -> Invisible on screen
   * DepthWrite: true  -> Writes to WebGL Z-buffer before garment renders
   */
  private build3DOccluders(): void {
    const occluderMat = new THREE.MeshBasicMaterial({
      colorWrite: false, // Does not write RGB pixels
      depthWrite: true,  // Writes to depth buffer
      depthTest: true,
      side: THREE.DoubleSide
    });

    // 1. Anatomical Neck Cylinder (frames the collar opening)
    // Extends from collar (Y=0) upward past chin (Y=+0.16)
    const neckRadius = 0.075;
    const neckHeight = 0.22;
    const neckGeom = new THREE.CylinderGeometry(neckRadius * 0.95, neckRadius, neckHeight, 24);
    neckGeom.translate(0, neckHeight / 2 - 0.02, -0.01);
    const neckMesh = new THREE.Mesh(neckGeom, occluderMat);
    neckMesh.renderOrder = -1; // Must render before garment!
    this.occluderGroup.add(neckMesh);

    // 2. Chin & Jaw Capsule / Sphere
    const chinRadius = 0.085;
    const chinGeom = new THREE.SphereGeometry(chinRadius, 20, 16);
    chinGeom.scale(1.0, 1.15, 1.25);
    chinGeom.translate(0, 0.16, 0.03);
    const chinMesh = new THREE.Mesh(chinGeom, occluderMat);
    chinMesh.renderOrder = -1;
    this.occluderGroup.add(chinMesh);

    // 3. Torso Core Ellipsoid (prevents back-of-shirt bleeding through front chest wall)
    const coreGeom = new THREE.CylinderGeometry(0.16, 0.14, 0.46, 24);
    coreGeom.scale(1.0, 1.0, 0.65);
    coreGeom.translate(0, -0.24, -0.02);
    const coreMesh = new THREE.Mesh(coreGeom, occluderMat);
    coreMesh.renderOrder = -1;
    this.occluderGroup.add(coreMesh);
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
