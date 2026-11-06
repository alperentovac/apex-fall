import { COLOR_THEMES } from './world';

export class JuiceManager {
  public cameraY = 0;
  public targetCameraY = 0;

  // Screen shake
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  // Background dust
  private dust: Array<{ x: number; y: number; size: number; baseAlpha: number; speed: number }> = [];
  private pulseTimer = 0;

  constructor(worldWidth: number, screenHeight: number) {
    for (let i = 0; i < 45; i++) {
      this.dust.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 3,
        size: 1 + Math.random() * 2,
        baseAlpha: 0.15 + Math.random() * 0.45,
        speed: 0.5 + Math.random() * 1.5
      });
    }
  }

  public addShake(magnitude = 8, duration = 0.2): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  public update(dt: number, playerY: number, screenHeight: number, isFallingFast: boolean): void {
    this.targetCameraY = playerY - screenHeight * 0.32;
    const lerpSpeed = isFallingFast ? 26 : 18;
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * lerpSpeed);

    this.pulseTimer += dt * 3.5;

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

  // Optimized background render
  public drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    _currentDepth: number,
    isFallingFast: boolean,
    _comboMultiplier: number,
    isMeteor: boolean = false,
    colorThemeIndex: number = 0
  ): void {
    const activeTheme = COLOR_THEMES[colorThemeIndex % COLOR_THEMES.length];

    // Dynamic Atmosphere Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isMeteor) {
      gradient.addColorStop(0, '#2b0008');
      gradient.addColorStop(0.5, '#480f00');
      gradient.addColorStop(1, '#180004');
    } else {
      gradient.addColorStop(0, '#060314');
      gradient.addColorStop(0.5, '#100826');
      gradient.addColorStop(1, '#03020a');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Central Vortex Spine
    const centerX = width / 2;
    ctx.save();
    const pillarGrad = ctx.createLinearGradient(centerX - 35, 0, centerX + 35, 0);
    const spineColor = isMeteor ? 'rgba(255, 68, 0, 0.22)' : activeTheme.glow;
    pillarGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pillarGrad.addColorStop(0.5, spineColor);
    pillarGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pillarGrad;
    ctx.fillRect(centerX - 40, 0, 80, height);

    // Vertical Perspective Guidelines
    const gridAlpha = 0.04 + 0.02 * Math.sin(this.pulseTimer);
    ctx.strokeStyle = isMeteor ? `rgba(255, 100, 0, ${gridAlpha * 2})` : activeTheme.glow;
    ctx.lineWidth = 1;
    const wallLeft = centerX - 145;
    const wallRight = centerX + 145;
    ctx.beginPath();
    ctx.moveTo(wallLeft, 0);
    ctx.lineTo(wallLeft, height);
    ctx.moveTo(wallRight, 0);
    ctx.lineTo(wallRight, height);
    ctx.stroke();

    // Parallax Dust
    for (const d of this.dust) {
      const dustY = (d.y - this.cameraY * 0.2 * d.speed) % height;
      const actualY = dustY < 0 ? dustY + height : dustY;
      ctx.fillStyle = isMeteor ? '#ffaa00' : '#ffffff';
      ctx.globalAlpha = d.baseAlpha;
      ctx.fillRect(d.x, actualY, d.size, d.size);
    }
    ctx.restore();

    // Speed warp lines
    if (isMeteor) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.65)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 16; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 60 + Math.random() * 120;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    } else if (isFallingFast) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 35 + Math.random() * 70;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
