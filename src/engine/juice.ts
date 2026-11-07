export class JuiceManager {
  public camera = { x: 0, y: 0, z: 0, zoom: 1.12 };
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  private shakeMagnitude = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Visual Turn Arc Smoothing (85ms rounded corner fillet curve)
  private turnArcTimer = 0;
  private readonly turnArcDuration = 0.085;
  private arcStart = { x: 0, y: 0 };
  private arcCorner = { x: 0, y: 0 };

  // Adaptive framerate-independent camera smoothing factor
  private readonly followSpeed = 6.5;

  // Lead offset frames the ball ~30% from top of screen so upcoming zigzag path is fully visible
  public forwardLead = 110;

  public reset(startX = 0, startY = 0): void {
    this.camera.x = startX + this.forwardLead;
    this.camera.y = startY + this.forwardLead;
    this.camera.z = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeTimer = 0;
    this.turnArcTimer = 0;
  }

  public triggerTurnArc(start: { x: number; y: number }, corner: { x: number; y: number }): void {
    this.arcStart = { x: start.x, y: start.y };
    this.arcCorner = { x: corner.x, y: corner.y };
    this.turnArcTimer = this.turnArcDuration;
  }

  public getVisualBallPosition(ball: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    if (this.turnArcTimer <= 0) {
      return { x: ball.x, y: ball.y, z: ball.z };
    }
    const t = 1 - (this.turnArcTimer / this.turnArcDuration);
    const oneMinusT = 1 - t;
    // Quadratic Bezier arc: smoothly rounds corner apex (Start -> Corner -> Current Ball)
    const visualX = oneMinusT * oneMinusT * this.arcStart.x + 2 * oneMinusT * t * this.arcCorner.x + t * t * ball.x;
    const visualY = oneMinusT * oneMinusT * this.arcStart.y + 2 * oneMinusT * t * this.arcCorner.y + t * t * ball.y;
    return { x: visualX, y: visualY, z: ball.z };
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
    if (this.turnArcTimer > 0) {
      this.turnArcTimer = Math.max(0, this.turnArcTimer - dt);
    }
    // Framerate-independent exponential smoothing
    const blend = 1 - Math.exp(-this.followSpeed * dt);

    const targetX = target.x + this.forwardLead;
    const targetY = target.y + this.forwardLead;

    this.camera.x += (targetX - this.camera.x) * blend;
    this.camera.y += (targetY - this.camera.y) * blend;

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
