import * as THREE from 'three';

/**
 * High-Performance 1-Euro Filter for AR/VR Motion Tracking
 * Based on: Casiez, G., Roussel, N. and Vogel, F. (2012)
 * "1 € Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  public filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = value;
    this.s = alpha * value + (1.0 - alpha) * this.s!;
    return this.s!;
  }

  public lastValue(): number | null {
    return this.s;
  }

  public reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(x: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      return this.xFilter.filter(x, 1.0);
    }

    const dt = Math.max(0.001, (timestampMs - this.lastTime) / 1000.0);
    this.lastTime = timestampMs;
    const rate = 1.0 / dt;

    const prevX = this.xFilter.lastValue();
    const dx = prevX === null ? 0 : (x - prevX) * rate;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(rate, cutoff));
  }

  public reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/**
 * 3D Vector 1-Euro Filter: Filters 3D Euclidean landmarks using joint velocity magnitude
 */
export class OneEuroVector3Filter {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;
  private zFilter: OneEuroFilter;
  private current: THREE.Vector3 = new THREE.Vector3();

  constructor(minCutoff: number = 1.2, beta: number = 0.012, dCutoff: number = 1.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.zFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  public filter(v: THREE.Vector3, timestampMs: number): THREE.Vector3 {
    this.current.set(
      this.xFilter.filter(v.x, timestampMs),
      this.yFilter.filter(v.y, timestampMs),
      this.zFilter.filter(v.z, timestampMs)
    );
    return this.current;
  }

  public get(): THREE.Vector3 {
    return this.current;
  }

  public reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
    this.zFilter.reset();
  }
}

/**
 * Geodesic SLERP Quaternion 1-Euro Filter
 * Prevents gimbal lock, resolves antipodal sign ambiguity (q == -q),
 * and dynamically adapts filtering cutoff to angular velocity.
 */
export class OneEuroQuaternionFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private current: THREE.Quaternion = new THREE.Quaternion();
  private prevQuat: THREE.Quaternion | null = null;
  private angularSpeedFilter: LowPassFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(minCutoff: number = 1.0, beta: number = 0.015, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(targetQuat: THREE.Quaternion, timestampMs: number): THREE.Quaternion {
    if (!this.prevQuat || this.lastTime === null) {
      this.prevQuat = targetQuat.clone();
      this.current.copy(targetQuat);
      this.lastTime = timestampMs;
      return this.current;
    }

    const dt = Math.max(0.001, (timestampMs - this.lastTime) / 1000.0);
    this.lastTime = timestampMs;
    const rate = 1.0 / dt;

    // Resolve antipodal ambiguity: if dot < 0, target is on opposite hemisphere
    const alignedTarget = targetQuat.clone();
    let dot = this.prevQuat.dot(alignedTarget);
    if (dot < 0) {
      alignedTarget.set(-alignedTarget.x, -alignedTarget.y, -alignedTarget.z, -alignedTarget.w);
      dot = -dot;
    }

    // Angular velocity estimation: omega = 2 * acos(dot) / dt
    const clampedDot = Math.min(1.0, Math.max(-1.0, dot));
    const angleDelta = 2.0 * Math.acos(clampedDot);
    const rawAngularSpeed = angleDelta * rate;

    const filteredSpeed = this.angularSpeedFilter.filter(
      rawAngularSpeed,
      this.alpha(rate, this.dCutoff)
    );

    const cutoff = this.minCutoff + this.beta * filteredSpeed;
    const slerpFactor = Math.min(1.0, Math.max(0.0, this.alpha(rate, cutoff)));

    // Spherical linear interpolation towards aligned target
    this.current.copy(this.prevQuat).slerp(alignedTarget, slerpFactor);
    this.current.normalize();
    this.prevQuat.copy(this.current);

    return this.current;
  }

  public get(): THREE.Quaternion {
    return this.current;
  }

  public reset(): void {
    this.prevQuat = null;
    this.lastTime = null;
    this.angularSpeedFilter.reset();
    this.current.identity();
  }
}
