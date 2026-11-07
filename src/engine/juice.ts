export class JuiceManager {
  public camera = { x: 0, y: 0, z: 0, zoom: 1 };
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  private shakeMagnitude = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Adaptive framerate-independent camera smoothing factor
  private readonly followSpeed = 8.5;

  public reset(startX = 0, startY = 0): void {
    this.camera.x = startX;
    this.camera.y = startY;
    this.camera.z = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeTimer = 0;
  }

  public triggerShake(magnitude = 5, duration = 0.18): void {
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  public update(
    dt: number,
    target: { x: number; y: number; z: number; isFalling: boolean }
  ): void {
    // Framerate-independent exponential smoothing
    const blend = 1 - Math.exp(-this.followSpeed * dt);

    this.camera.x += (target.x - this.camera.x) * blend;
    this.camera.y += (target.y - this.camera.y) * blend;

    // Subtle camera dip when falling
    if (target.isFalling) {
      const targetZ = Math.max(-40, target.z * 0.25);
      this.camera.z += (targetZ - this.camera.z) * (1 - Math.exp(-6 * dt));
    } else {
      this.camera.z += (0 - this.camera.z) * (1 - Math.exp(-10 * dt));
    }

    // Screen shake update
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = Math.max(0, this.shakeTimer / this.shakeDuration);
      const mag = this.shakeMagnitude * progress;
      this.shakeOffsetX = (Math.random() * 2 - 1) * mag;
      this.shakeOffsetY = (Math.random() * 2 - 1) * mag;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  public getRenderCamera(): { x: number; y: number; zoom: number } {
    return {
      x: this.camera.x + this.shakeOffsetX,
      y: this.camera.y + this.shakeOffsetY,
      zoom: this.camera.zoom
    };
  }
}
