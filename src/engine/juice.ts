export class JuiceManager {
  public cameraY = 0;
  public targetCameraY = 0;
  
  // Screen shake
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  // Background grid stars
  private stars: Array<{ x: number; y: number; size: number; baseAlpha: number }> = [];

  constructor(worldWidth: number, screenHeight: number) {
    // Generate background stars
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 4,
        size: 1 + Math.random() * 2,
        baseAlpha: 0.2 + Math.random() * 0.6
      });
    }
  }

  public addShake(magnitude = 10, duration = 0.25): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  public update(dt: number, playerY: number, screenHeight: number, isFallingFast: boolean): void {
    // Camera targeting: keep player around 60% down the screen when climbing
    this.targetCameraY = playerY - screenHeight * 0.62;

    // Faster tracking when climbing and dizzying drop speed
    const lerpSpeed = isFallingFast ? 26 : 16;
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * lerpSpeed);

    // Screen shake update
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const progress = Math.max(0, this.shakeTime / this.shakeDuration);
      const currentMag = this.shakeMagnitude * progress;
      this.shakeOffsetX = (Math.random() - 0.5) * currentMag * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * currentMag * 2;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeMagnitude = 0;
    }
  }

  public drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFloor: number,
    isFallingFast: boolean,
    comboMultiplier: number,
    isOverdriveActive: boolean = false
  ): void {
    // Gradient sky that darkens/changes with height
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (currentFloor < 10) {
      gradient.addColorStop(0, '#100b24');
      gradient.addColorStop(1, '#05040a');
    } else if (currentFloor < 25) {
      gradient.addColorStop(0, '#220836');
      gradient.addColorStop(1, '#0a0515');
    } else {
      // Stratosphere / Deep cosmic rage
      gradient.addColorStop(0, '#02182b');
      gradient.addColorStop(1, '#030612');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Perspective synthwave grid lines moving with camera
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    const offsetY = (-this.cameraY * 0.3) % gridSpacing;

    for (let y = offsetY; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid guidelines
    for (let x = 0; x <= width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Distant background stars
    for (const star of this.stars) {
      const starY = (star.y - this.cameraY * 0.15) % height;
      const actualY = starY < 0 ? starY + height : starY;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = star.baseAlpha;
      ctx.fillRect(star.x, actualY, star.size, star.size);
    }
    ctx.restore();

    // High combo adrenaline vignette
    if (comboMultiplier > 2) {
      const glowAlpha = Math.min(0.4, (comboMultiplier - 2) * 0.05);
      const vig = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.35,
        width / 2, height / 2, height * 0.75
      );
      vig.addColorStop(0, 'rgba(255, 0, 128, 0)');
      vig.addColorStop(1, `rgba(255, 0, 128, ${glowAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    // Hyper Rocket Overdrive supersonic warp effect
    if (isOverdriveActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.65)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 28; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 90 + Math.random() * 160;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // High speed falling danger speed-lines (Dread indicator)
    if (isFallingFast) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 30, 60, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 40 + Math.random() * 90;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
