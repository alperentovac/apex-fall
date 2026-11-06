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
    _colorThemeIndex: number = 0
  ): void {
    // Base Cosmic Tunnel Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isMeteor) {
      gradient.addColorStop(0, '#260408');
      gradient.addColorStop(0.4, '#3d0a02');
      gradient.addColorStop(1, '#150103');
    } else {
      gradient.addColorStop(0, '#03010b');
      gradient.addColorStop(0.4, '#09041a');
      gradient.addColorStop(1, '#020108');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.40;

    ctx.save();

    // 1. Sector Ambient Glows (Left: Cyan, Top: Purple, Right: Amber - exactly matching 1.png)
    // Left Cyan Sector Glow
    const cyanAura = ctx.createRadialGradient(cx - 90, cy + 20, 10, cx - 90, cy + 20, 180);
    cyanAura.addColorStop(0, isMeteor ? 'rgba(255, 120, 0, 0.22)' : 'rgba(0, 240, 255, 0.16)');
    cyanAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cyanAura;
    ctx.beginPath();
    ctx.arc(cx - 90, cy + 20, 180, 0, Math.PI * 2);
    ctx.fill();

    // Top Purple Sector Glow
    const purpleAura = ctx.createRadialGradient(cx, cy - 80, 10, cx, cy - 80, 180);
    purpleAura.addColorStop(0, isMeteor ? 'rgba(255, 60, 0, 0.25)' : 'rgba(168, 85, 247, 0.18)');
    purpleAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = purpleAura;
    ctx.beginPath();
    ctx.arc(cx, cy - 80, 180, 0, Math.PI * 2);
    ctx.fill();

    // Right Amber Sector Glow
    const amberAura = ctx.createRadialGradient(cx + 90, cy + 20, 10, cx + 90, cy + 20, 180);
    amberAura.addColorStop(0, isMeteor ? 'rgba(255, 160, 0, 0.24)' : 'rgba(245, 158, 11, 0.15)');
    amberAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = amberAura;
    ctx.beginPath();
    ctx.arc(cx + 90, cy + 20, 180, 0, Math.PI * 2);
    ctx.fill();

    // 2. Perspective Radial Spoke Lines (16 Spoke Rays emanating from center)
    const spokeCount = 16;
    const maxDist = Math.max(width, height) * 1.2;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI * 2) / spokeCount;
      const endX = cx + Math.cos(angle) * maxDist;
      const endY = cy + Math.sin(angle) * maxDist;

      // Colorize by angle sector
      let strokeColor = 'rgba(255, 255, 255, 0.08)';
      if (angle >= Math.PI * 0.6 && angle < Math.PI * 1.25) {
        strokeColor = 'rgba(0, 240, 255, 0.14)'; // Cyan sector
      } else if (angle >= Math.PI * 1.25 && angle < Math.PI * 1.85) {
        strokeColor = 'rgba(168, 85, 247, 0.15)'; // Purple sector
      } else if (angle >= Math.PI * 1.85 || angle < Math.PI * 0.4) {
        strokeColor = 'rgba(245, 158, 11, 0.14)'; // Amber sector
      }

      ctx.strokeStyle = isMeteor ? 'rgba(255, 100, 0, 0.22)' : strokeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 18, cy + Math.sin(angle) * 18);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // 3. Background Concentric Depth Rings (Cylindrical tunnel wall tiles)
    const bgRings = [32, 60, 96, 140, 195, 260, 340];
    for (const r of bgRings) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 4. Parallax Cosmic Stardust (Radiating outward from vortex core)
    for (const d of this.dust) {
      const pAngle = (d.x / width) * Math.PI * 2;
      const pDist = ((d.y + this.cameraY * 0.35 * d.speed) % 360) + 16;
      const px = cx + Math.cos(pAngle) * pDist;
      const py = cy + Math.sin(pAngle) * pDist * 0.85;

      ctx.fillStyle = isMeteor ? '#ffaa00' : (pDist > 180 ? '#00f0ff' : '#ffffff');
      ctx.globalAlpha = Math.min(1, d.baseAlpha * (pDist / 200));
      ctx.fillRect(px, py, d.size, d.size);
    }
    ctx.globalAlpha = 1;

    // 5. Center Vortex Core (Radiant glowing flare as in 1.png)
    const corePulse = 1 + 0.12 * Math.sin(this.pulseTimer * 1.8);
    const flareRadius = 80 * corePulse;
    const vortexFlare = ctx.createRadialGradient(cx, cy, 2, cx, cy, flareRadius);
    if (isMeteor) {
      vortexFlare.addColorStop(0, '#ffffff');
      vortexFlare.addColorStop(0.18, '#ffe600');
      vortexFlare.addColorStop(0.45, 'rgba(255, 68, 0, 0.8)');
      vortexFlare.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      vortexFlare.addColorStop(0, '#ffffff');
      vortexFlare.addColorStop(0.14, '#f472b6');
      vortexFlare.addColorStop(0.42, 'rgba(168, 85, 247, 0.7)');
      vortexFlare.addColorStop(0.75, 'rgba(126, 34, 206, 0.25)');
      vortexFlare.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = vortexFlare;
    ctx.beginPath();
    ctx.arc(cx, cy, flareRadius, 0, Math.PI * 2);
    ctx.fill();

    // Central white sparkle point
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * corePulse, 0, Math.PI * 2);
    ctx.fill();

    // Radial flare starburst needles
    ctx.strokeStyle = isMeteor ? 'rgba(255, 200, 100, 0.5)' : 'rgba(240, 180, 255, 0.55)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const rayAngle = (k * Math.PI) / 3 + this.pulseTimer * 0.15;
      const rayLen = 28 * corePulse;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(rayAngle) * rayLen, cy - Math.sin(rayAngle) * rayLen);
      ctx.lineTo(cx + Math.cos(rayAngle) * rayLen, cy + Math.sin(rayAngle) * rayLen);
      ctx.stroke();
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
