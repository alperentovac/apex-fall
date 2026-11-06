export class JuiceManager {
  public cameraY = 0;
  public targetCameraY = 0;

  // Screen shake
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  // Background stars / depth dust
  private dust: Array<{ x: number; y: number; size: number; baseAlpha: number; speed: number }> = [];
  private pulseTimer = 0;

  constructor(worldWidth: number, screenHeight: number) {
    for (let i = 0; i < 70; i++) {
      this.dust.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 4,
        size: 1 + Math.random() * 2.5,
        baseAlpha: 0.2 + Math.random() * 0.6,
        speed: 0.5 + Math.random() * 1.5
      });
    }
  }

  public addShake(magnitude = 10, duration = 0.25): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  public update(dt: number, playerY: number, screenHeight: number, isFallingFast: boolean): void {
    // Camera keeps player comfortably in upper-middle view so player sees upcoming rings below
    this.targetCameraY = playerY - screenHeight * 0.32;

    const lerpSpeed = isFallingFast ? 24 : 16;
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * lerpSpeed);

    this.pulseTimer += dt * 3.5;

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
    currentDepth: number,
    isFallingFast: boolean,
    comboMultiplier: number,
    isMeteor: boolean = false
  ): void {
    // 1. Dynamic Infinite Vortex Sky Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isMeteor) {
      // Blazing Firestorm Atmosphere
      gradient.addColorStop(0, '#2d0006');
      gradient.addColorStop(0.5, '#4a0e00');
      gradient.addColorStop(1, '#1a0005');
    } else if (currentDepth < 15) {
      // Deep Cyberpunk Midnight
      gradient.addColorStop(0, '#090518');
      gradient.addColorStop(0.5, '#130c2e');
      gradient.addColorStop(1, '#05030e');
    } else if (currentDepth < 35) {
      // Neon Ultraviolet
      gradient.addColorStop(0, '#1c0326');
      gradient.addColorStop(0.5, '#3a0945');
      gradient.addColorStop(1, '#0c0214');
    } else {
      // Solar Amber / Deep Abyss
      gradient.addColorStop(0, '#140c02');
      gradient.addColorStop(0.5, '#2e1805');
      gradient.addColorStop(1, '#080501');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Central Vortex Cylinder Spine (Vertical tunnel glow)
    const centerX = width / 2;
    ctx.save();
    const pillarGrad = ctx.createLinearGradient(centerX - 35, 0, centerX + 35, 0);
    const pillarColor = isMeteor
      ? 'rgba(255, 68, 0, 0.22)'
      : (currentDepth < 15 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 0, 187, 0.15)');
    pillarGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pillarGrad.addColorStop(0.5, pillarColor);
    pillarGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = pillarGrad;
    ctx.fillRect(centerX - 40, 0, 80, height);
    ctx.restore();

    // 3. Vertical Perspective Speed Grid
    ctx.save();
    const gridAlpha = 0.04 + 0.02 * Math.sin(this.pulseTimer);
    ctx.strokeStyle = isMeteor ? `rgba(255, 100, 0, ${gridAlpha * 2})` : `rgba(0, 240, 255, ${gridAlpha})`;
    ctx.lineWidth = 1;

    // Tunnel wall guide lines radiating down
    const wallLeft = centerX - 150;
    const wallRight = centerX + 150;
    ctx.beginPath();
    ctx.moveTo(wallLeft, 0);
    ctx.lineTo(wallLeft, height);
    ctx.moveTo(wallRight, 0);
    ctx.lineTo(wallRight, height);
    ctx.stroke();

    // 4. Parallax Depth Dust (Floating upwards as player dives down)
    for (const d of this.dust) {
      const dustY = (d.y - this.cameraY * 0.2 * d.speed) % height;
      const actualY = dustY < 0 ? dustY + height : dustY;
      ctx.fillStyle = isMeteor ? '#ffaa00' : '#ffffff';
      ctx.globalAlpha = d.baseAlpha;
      ctx.fillRect(d.x, actualY, d.size, d.size);
    }
    ctx.restore();

    // 5. Adrenaline Combo Glow Vignette
    if (comboMultiplier > 2) {
      ctx.save();
      const glowAlpha = Math.min(0.35, (comboMultiplier - 2) * 0.06);
      const vig = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.35,
        width / 2, height / 2, height * 0.75
      );
      const edgeColor = isMeteor
        ? `rgba(255, 68, 0, ${glowAlpha * 1.5})`
        : `rgba(255, 0, 128, ${glowAlpha})`;
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, edgeColor);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 6. Meteor Fireball Speed Warp Lines
    if (isMeteor) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.7)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 20; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 70 + Math.random() * 140;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Fast Falling Speed Lines
    if (isFallingFast && !isMeteor) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 40 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
