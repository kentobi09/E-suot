import * as THREE from 'three';
import { OneEuroVector3Filter, OneEuroQuaternionFilter } from './landmarkSmoothing';

export interface WorldLandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface UpperBodyBones {
  root: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  leftClavicle: THREE.Bone;
  rightClavicle: THREE.Bone;
  leftArm: THREE.Bone;
  rightArm: THREE.Bone;
}

/**
 * Production-Grade Skeleton Controller
 * Computes orthonormal Gram-Schmidt coordinate frames and drives a 7-bone SkinnedMesh hierarchy
 * from MediaPipe worldLandmarks (indices 11, 12, 13, 14, 23, 24).
 */
export class SkeletonController {
  private bones: UpperBodyBones;
  private skeleton: THREE.Skeleton;

  // 1-Euro Filters for jitter-free tracking
  private rootPosFilter = new OneEuroVector3Filter(1.2, 0.015);
  private rootRotFilter = new OneEuroQuaternionFilter(1.0, 0.018);
  private spineRotFilter = new OneEuroQuaternionFilter(1.0, 0.018);
  private chestRotFilter = new OneEuroQuaternionFilter(1.0, 0.018);
  private leftArmRotFilter = new OneEuroQuaternionFilter(1.5, 0.025);
  private rightArmRotFilter = new OneEuroQuaternionFilter(1.5, 0.025);

  // Reusable math objects
  private mat3 = new THREE.Matrix4();
  private basisX = new THREE.Vector3();
  private basisY = new THREE.Vector3();
  private basisZ = new THREE.Vector3();

  constructor() {
    // 1. Initialize Humanoid Upper-Body Rig Hierarchy
    const root = new THREE.Bone();
    root.name = 'Root';

    const spine = new THREE.Bone();
    spine.name = 'Spine';

    const chest = new THREE.Bone();
    chest.name = 'Chest';

    const neck = new THREE.Bone();
    neck.name = 'Neck';

    const leftClavicle = new THREE.Bone();
    leftClavicle.name = 'L_Clavicle';

    const rightClavicle = new THREE.Bone();
    rightClavicle.name = 'R_Clavicle';

    const leftArm = new THREE.Bone();
    leftArm.name = 'L_Arm';

    const rightArm = new THREE.Bone();
    rightArm.name = 'R_Arm';

    // Hierarchy linkage
    root.add(spine);
    spine.add(chest);
    chest.add(neck);
    chest.add(leftClavicle);
    chest.add(rightClavicle);
    leftClavicle.add(leftArm);
    rightClavicle.add(rightArm);

    // Initial anatomical rest-pose offsets (in meters)
    spine.position.set(0, 0.18, 0);
    chest.position.set(0, 0.22, 0);
    neck.position.set(0, 0.12, 0);
    leftClavicle.position.set(-0.18, 0.04, 0);
    rightClavicle.position.set(0.18, 0.04, 0);
    leftArm.position.set(-0.06, -0.02, 0);
    rightArm.position.set(0.06, -0.02, 0);

    this.bones = {
      root,
      spine,
      chest,
      neck,
      leftClavicle,
      rightClavicle,
      leftArm,
      rightArm
    };

    this.skeleton = new THREE.Skeleton([
      root,
      spine,
      chest,
      neck,
      leftClavicle,
      rightClavicle,
      leftArm,
      rightArm
    ]);
  }

  public getSkeleton(): THREE.Skeleton {
    return this.skeleton;
  }

  public getBones(): UpperBodyBones {
    return this.bones;
  }

  /**
   * Solves bone transforms and joint rotations per frame using Gram-Schmidt orthogonalization
   * @param worldLandmarks Array of 33 metric 3D landmarks from MediaPipe Pose
   * @param timestampMs Monotonic animation timestamp
   */
  public update(worldLandmarks: WorldLandmarkPoint[], timestampMs: number): void {
    if (!worldLandmarks || worldLandmarks.length < 25) return;

    // MediaPipe key landmark metric points (converted to Three.js space: Y up, Z towards viewer)
    // 11: left_shoulder, 12: right_shoulder, 13: left_elbow, 14: right_elbow, 23: left_hip, 24: right_hip
    const ls = this.toThreeVector(worldLandmarks[11]);
    const rs = this.toThreeVector(worldLandmarks[12]);
    const le = this.toThreeVector(worldLandmarks[13]);
    const re = this.toThreeVector(worldLandmarks[14]);
    const lh = this.toThreeVector(worldLandmarks[23]);
    const rh = this.toThreeVector(worldLandmarks[24]);

    const midHip = new THREE.Vector3().addVectors(lh, rh).multiplyScalar(0.5);
    const midShoulder = new THREE.Vector3().addVectors(ls, rs).multiplyScalar(0.5);

    // -------------------------------------------------------------
    // Gram-Schmidt Orthonormal Torso Coordinate Frame
    // -------------------------------------------------------------
    // Vector X: lateral biacromial axis (left shoulder towards right shoulder)
    this.basisX.subVectors(rs, ls).normalize();

    // Vector Y: spine axis (mid-hip towards mid-shoulder), orthogonalized to X
    const rawY = new THREE.Vector3().subVectors(midShoulder, midHip);
    const projYonX = this.basisX.clone().multiplyScalar(rawY.dot(this.basisX));
    this.basisY.subVectors(rawY, projYonX).normalize();

    // Vector Z: normal cross product (pointing anteriorly / chest front)
    this.basisZ.crossVectors(this.basisX, this.basisY).normalize();

    // Rotation Matrix R = [X, Y, Z]
    this.mat3.makeBasis(this.basisX, this.basisY, this.basisZ);
    const targetTorsoQuat = new THREE.Quaternion().setFromRotationMatrix(this.mat3);

    // Filter root position & orientation
    const filteredRootPos = this.rootPosFilter.filter(midHip, timestampMs);
    const filteredTorsoQuat = this.rootRotFilter.filter(targetTorsoQuat, timestampMs);

    this.bones.root.position.copy(filteredRootPos);
    this.bones.root.quaternion.copy(filteredTorsoQuat);

    // Adaptive torso scale & lengths based on subject anthropometry
    const spineLength = rawY.length();
    this.bones.spine.position.y = Math.max(0.12, spineLength * 0.45);
    this.bones.chest.position.y = Math.max(0.14, spineLength * 0.55);

    const shoulderSpan = ls.distanceTo(rs);
    const halfSpan = Math.max(0.14, shoulderSpan * 0.5);
    this.bones.leftClavicle.position.x = -halfSpan;
    this.bones.rightClavicle.position.x = halfSpan;

    // -------------------------------------------------------------
    // Arms Kinematics (Humerus Orientation relative to Torso)
    // -------------------------------------------------------------
    const invTorsoQuat = filteredTorsoQuat.clone().invert();

    // Left Arm (Screen Left)
    const rawLeftArmDir = new THREE.Vector3().subVectors(le, ls).normalize();
    const localLeftArmDir = rawLeftArmDir.applyQuaternion(invTorsoQuat).normalize();
    // Default rest pose of arm is pointing down (0, -1, 0)
    const targetLeftArmQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      localLeftArmDir
    );
    const filteredLeftArmQuat = this.leftArmRotFilter.filter(targetLeftArmQuat, timestampMs);
    this.bones.leftArm.quaternion.copy(filteredLeftArmQuat);

    // Right Arm (Screen Right)
    const rawRightArmDir = new THREE.Vector3().subVectors(re, rs).normalize();
    const localRightArmDir = rawRightArmDir.applyQuaternion(invTorsoQuat).normalize();
    const targetRightArmQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      localRightArmDir
    );
    const filteredRightArmQuat = this.rightArmRotFilter.filter(targetRightArmQuat, timestampMs);
    this.bones.rightArm.quaternion.copy(filteredRightArmQuat);

    // Update entire skeletal hierarchy matrices
    this.skeleton.update();
  }

  private toThreeVector(mp: WorldLandmarkPoint): THREE.Vector3 {
    // Invert Y and Z from MediaPipe camera-centric coordinates to Three.js world coordinates
    return new THREE.Vector3(mp.x, -mp.y, -mp.z);
  }

  /**
   * Constructs a parametric skinned t-shirt mesh with vertex bone indices and smooth linear blend weights
   */
  public createRiggedGarmentMesh(material: THREE.Material): THREE.SkinnedMesh {
    const radialSegs = 28;
    const heightSegs = 24;
    const geom = new THREE.CylinderGeometry(0.24, 0.22, 0.65, radialSegs, heightSegs, true);

    // Center geometry with collar at top
    geom.translate(0, -0.32, 0);

    const pos = geom.attributes.position;
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];

    // Assign skinning weights:
    // Bone 0: Root
    // Bone 1: Spine (lower torso)
    // Bone 2: Chest (upper torso & shoulders)
    // Bone 3: Neck (collar)
    // Bone 6: Left Arm
    // Bone 7: Right Arm
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // Ranges from ~0 (collar) down to -0.65 (hem)

      const normalizedY = Math.max(0, Math.min(1, (y + 0.65) / 0.65)); // 0 at hem, 1 at collar

      if (normalizedY > 0.85) {
        // Collar & high chest
        skinIndices.push(2, 3, 1, 0);
        skinWeights.push(0.70, 0.30, 0.0, 0.0);
      } else if (normalizedY > 0.45) {
        // Mid to upper chest
        const chestWeight = (normalizedY - 0.45) / 0.4;
        const spineWeight = 1.0 - chestWeight;

        // Influence of arms on lateral vertices
        const lateralDist = Math.abs(x);
        if (lateralDist > 0.16) {
          const armBone = x < 0 ? 6 : 7; // L_Arm vs R_Arm
          skinIndices.push(2, armBone, 1, 0);
          skinWeights.push(chestWeight * 0.65, 0.35, spineWeight * 0.65, 0.0);
        } else {
          skinIndices.push(2, 1, 0, 0);
          skinWeights.push(chestWeight, spineWeight, 0.0, 0.0);
        }
      } else {
        // Lower torso to hem (Spine & Root)
        const rootWeight = (0.45 - normalizedY) / 0.45;
        const spineWeight = 1.0 - rootWeight;
        skinIndices.push(1, 0, 2, 0);
        skinWeights.push(spineWeight, rootWeight, 0.0, 0.0);
      }
    }

    geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geom.computeVertexNormals();

    const skinnedMesh = new THREE.SkinnedMesh(geom, material);
    skinnedMesh.add(this.bones.root);
    skinnedMesh.bind(this.skeleton);

    return skinnedMesh;
  }
}
