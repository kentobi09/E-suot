import * as THREE from 'three';

export interface ProcrustesResult {
  matrix: THREE.Matrix4;
  scale: number;
  rotation: THREE.Quaternion;
  translation: THREE.Vector3;
}

/**
 * 3x3 Determinant helper
 */
function det3(M: number[][]): number {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

/**
 * Fast Jacobi SVD for 3x3 real matrices
 * Solves A = U * diag(S) * V^T
 */
function svd3(A: number[][]): { U: number[][]; S: number[]; V: number[][] } {
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
  const AtA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        AtA[i][j] += A[k][i] * A[k][j];
      }
    }
  }

  // 15 Jacobi sweeps guarantee convergence to machine precision (< 1e-14)
  for (let iter = 0; iter < 15; iter++) {
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const app = AtA[p][p];
        const apq = AtA[p][q];
        const aqq = AtA[q][q];
        if (Math.abs(apq) < 1e-12) continue;

        const tau = (aqq - app) / (2 * apq);
        const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        AtA[p][p] = app - t * apq;
        AtA[q][q] = aqq + t * apq;
        AtA[p][q] = 0;
        AtA[q][p] = 0;

        for (let r = 0; r < 3; r++) {
          if (r !== p && r !== q) {
            const arp = AtA[r][p];
            const arq = AtA[r][q];
            AtA[r][p] = c * arp - s * arq;
            AtA[p][r] = AtA[r][p];
            AtA[r][q] = s * arp + c * arq;
            AtA[q][r] = AtA[r][q];
          }
          const vrp = V[r][p];
          const vrq = V[r][q];
          V[r][p] = c * vrp - s * vrq;
          V[r][q] = s * vrp + c * vrq;
        }
      }
    }
  }

  const S = [
    Math.sqrt(Math.max(0, AtA[0][0])),
    Math.sqrt(Math.max(0, AtA[1][1])),
    Math.sqrt(Math.max(0, AtA[2][2]))
  ];

  const U = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (S[j] > 1e-9) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += A[i][k] * V[k][j];
        U[i][j] = sum / S[j];
      } else {
        U[i][j] = i === j ? 1 : 0;
      }
    }
  }

  return { U, S, V };
}

/**
 * Closed-Form Umeyama / Kabsch Procrustes Alignment Algorithm
 * Computes the optimal similarity transformation (Uniform Scale s, Rotation R, Translation t)
 * that minimizes the squared Euclidean distance between canonical source and live tracked target points:
 *   argmin_{s, R, t} sum || target_i - (s * R * source_i + t) ||^2
 */
export function solveProcrustes(
  sourcePoints: THREE.Vector3[],
  targetPoints: THREE.Vector3[]
): ProcrustesResult {
  const n = Math.min(sourcePoints.length, targetPoints.length);
  if (n < 3) {
    return {
      matrix: new THREE.Matrix4(),
      scale: 1,
      rotation: new THREE.Quaternion(),
      translation: new THREE.Vector3()
    };
  }

  // 1. Compute Centroids
  let muSrc = new THREE.Vector3();
  let muDst = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    muSrc.add(sourcePoints[i]);
    muDst.add(targetPoints[i]);
  }
  muSrc.multiplyScalar(1 / n);
  muDst.multiplyScalar(1 / n);

  // 2. Centered vectors and source variance
  const X: number[][] = [];
  const Y: number[][] = [];
  let varSrc = 0;

  for (let i = 0; i < n; i++) {
    const dx = sourcePoints[i].x - muSrc.x;
    const dy = sourcePoints[i].y - muSrc.y;
    const dz = sourcePoints[i].z - muSrc.z;
    X.push([dx, dy, dz]);
    varSrc += dx * dx + dy * dy + dz * dz;

    Y.push([
      targetPoints[i].x - muDst.x,
      targetPoints[i].y - muDst.y,
      targetPoints[i].z - muDst.z
    ]);
  }
  varSrc /= n;

  // 3. Cross-covariance matrix H = (1/n) * sum(Y_i * X_i^T)
  const H: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        H[r][c] += Y[i][r] * X[i][c];
      }
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      H[r][c] /= n;
    }
  }

  // 4. SVD of H = U * S * V^T
  const { U, S, V } = svd3(H);

  // Compute U * V^T to verify determinant (reflection check)
  const UVt: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) {
        UVt[r][c] += U[r][k] * V[c][k];
      }
    }
  }

  const d = Math.sign(det3(UVt)) || 1;
  const D = [1, 1, d];

  // 5. Optimal Rotation Matrix R = U * D * V^T
  const R: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) {
        R[r][c] += U[r][k] * D[k] * V[c][k];
      }
    }
  }

  // 6. Optimal Scale Factor s = tr(D * S) / varSrc
  let s = (S[0] * D[0] + S[1] * D[1] + S[2] * D[2]) / (varSrc || 1);
  // Sanity clamp on scale to prevent extreme blowup or vanishing
  s = Math.max(0.01, Math.min(100.0, s));

  // 7. Optimal Translation Vector t = muDst - s * R * muSrc
  const sRmuSrc = new THREE.Vector3(
    s * (R[0][0] * muSrc.x + R[0][1] * muSrc.y + R[0][2] * muSrc.z),
    s * (R[1][0] * muSrc.x + R[1][1] * muSrc.y + R[1][2] * muSrc.z),
    s * (R[2][0] * muSrc.x + R[2][1] * muSrc.y + R[2][2] * muSrc.z)
  );
  const translation = new THREE.Vector3().subVectors(muDst, sRmuSrc);

  // Construct Three.js Rotation Matrix & Quaternion
  const rotMatrix = new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], 0,
    R[1][0], R[1][1], R[1][2], 0,
    R[2][0], R[2][1], R[2][2], 0,
    0, 0, 0, 1
  );
  const rotation = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

  // Construct Complete Affine Matrix4
  const matrix = new THREE.Matrix4();
  matrix.compose(translation, rotation, new THREE.Vector3(s, s, s));

  return {
    matrix,
    scale: s,
    rotation,
    translation
  };
}
