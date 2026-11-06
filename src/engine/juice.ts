interface NebulaCloud {
  angle: number;
  baseDist: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  driftSpeed: number;
  pulsePhase: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  flickerSpeed: number;
  flickerOffset: number;
  color: string;
  isFlare: boolean;
}

export class JuiceManager {
  public cameraY = 0;
  public targetCameraY = 0;

  // Screen shake
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  // Background Cosmic Voyage Elements
  private dust: Array<{ x: number; y: number; size: number; baseAlpha: number; speed: number }> = [];
  private stars: Star[] = [];
  private nebulaClouds: NebulaCloud[] = [];
  private pulseTimer = 0;

  constructor(worldWidth: number, screenHeight: number) {
    // 1. Cosmic Dust Particles (Warp flight perspective drift)
    for (let i = 0; i < 55; i++) {
      this.dust.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 3,
        size: 1 + Math.random() * 2.2,
        baseAlpha: 0.2 + Math.random() * 0.55,
        speed: 0.6 + Math.random() * 1.6
      });
    }

    // 2. Realistic Twinkling Starfield
    const starColors = ['#ffffff', '#e0f2fe', '#f3e8ff', '#fef9c3', '#bae6fd'];
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 2,
        size: Math.random() < 0.85 ? (0.8 + Math.random() * 1.4) : (2.2 + Math.random() * 1.2),
        baseAlpha: 0.35 + Math.random() * 0.55,
        flickerSpeed: 1.5 + Math.random() * 3.5,
        flickerOffset: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        isFlare: Math.random() < 0.12
      });
    }

    // 3. Volumetric Nebula Dust Clouds (Cosmic Rose, Galactic Cyan, Violet, Stardust Gold)
    const cloudPalettes = [
      { r: 236, g: 72, b: 153, a: 0.16 }, // Cosmic Magenta / Rose
      { r: 6, g: 182, b: 212, a: 0.15 },  // Celestial Aqua / Cyan
      { r: 168, g: 85, b: 247, a: 0.18 }, // Deep Ultraviolet / Purple
      { r: 99, g: 102, b: 241, a: 0.14 }, // Cosmic Indigo
      { r: 245, g: 158, b: 11, a: 0.13 }, // Stardust Amber / Gold
      { r: 244, g: 114, b: 182, a: 0.14 } // Nebula Pink
    ];

    for (let i = 0; i < cloudPalettes.length; i++) {
      const p = cloudPalettes[i];
      this.nebulaClouds.push({
        angle: (i * Math.PI * 2) / cloudPalettes.length + (Math.random() - 0.5) * 0.5,
        baseDist: 90 + Math.random() * 130,
        radius: 140 + Math.random() * 90,
        r: p.r,
        g: p.g,
        b: p.b,
        alpha: p.a,
        driftSpeed: (Math.random() - 0.5) * 0.08,
        pulsePhase: Math.random() * Math.PI * 2
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

    this.pulseTimer += dt * 2.8;

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

  // Deep Space Interstellar Voyage Renderer: Volumetric Nebula Clouds, Multi-layer Starfield & Stardust
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
    const cx = width / 2;
    const cy = height * 0.40;

    // 1. Deep Celestial Space Void
    const baseSpaceGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isMeteor) {
      baseSpaceGrad.addColorStop(0, '#1c0309');
      baseSpaceGrad.addColorStop(0.45, '#350a04');
      baseSpaceGrad.addColorStop(1, '#0e0104');
    } else {
      baseSpaceGrad.addColorStop(0, '#020008');
      baseSpaceGrad.addColorStop(0.35, '#070216');
      baseSpaceGrad.addColorStop(0.7, '#04010e');
      baseSpaceGrad.addColorStop(1, '#010005');
    }
    ctx.fillStyle = baseSpaceGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // 2. Volumetric Nebula Dust Clouds (Ethereal Cosmic Gas Clouds drifting with parallax)
    for (const cloud of this.nebulaClouds) {
      const curAngle = cloud.angle + this.pulseTimer * cloud.driftSpeed;
      const pulse = 1 + 0.15 * Math.sin(this.pulseTimer * 1.4 + cloud.pulsePhase);
      const cloudDist = cloud.baseDist * pulse;
      const cloudX = cx + Math.cos(curAngle) * cloudDist;
      const cloudY = cy + Math.sin(curAngle) * cloudDist * 0.75;
      const cloudR = cloud.radius * pulse;

      const grad = ctx.createRadialGradient(cloudX, cloudY, cloudR * 0.05, cloudX, cloudY, cloudR);
      const r = isMeteor ? 255 : cloud.r;
      const g = isMeteor ? 100 : cloud.g;
      const b = isMeteor ? 30 : cloud.b;
      const cloudAlpha = isMeteor ? cloud.alpha * 1.4 : cloud.alpha;

      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${cloudAlpha * 1.1})`);
      grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${cloudAlpha * 0.55})`);
      grad.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, ${cloudAlpha * 0.18})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, cloudR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Multi-layer Twinkling Starfield
    for (const star of this.stars) {
      const starY = (star.y - this.cameraY * 0.15) % height;
      const sy = starY < 0 ? starY + height : starY;
      const twinkle = 0.55 + 0.45 * Math.sin(this.pulseTimer * star.flickerSpeed + star.flickerOffset);
      const alpha = Math.min(1, Math.max(0.1, star.baseAlpha * twinkle));

      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha;

      if (star.isFlare) {
        // 4-point stellar flare for brighter stars
        const fSize = star.size * 1.8;
        ctx.beginPath();
        ctx.arc(star.x, sy, star.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(star.x - fSize, sy);
        ctx.lineTo(star.x + fSize, sy);
        ctx.moveTo(star.x, sy - fSize);
        ctx.lineTo(star.x, sy + fSize);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(star.x, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 4. Subtle Ambient Sector Glows (Sleek, minimalist background tint)
    const auraRadius = 160;
    const leftAura = ctx.createRadialGradient(cx - 85, cy + 15, 10, cx - 85, cy + 15, auraRadius);
    leftAura.addColorStop(0, isMeteor ? 'rgba(255, 100, 0, 0.18)' : 'rgba(0, 240, 255, 0.12)');
    leftAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftAura;
    ctx.beginPath();
    ctx.arc(cx - 85, cy + 15, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    const rightAura = ctx.createRadialGradient(cx + 85, cy + 15, 10, cx + 85, cy + 15, auraRadius);
    rightAura.addColorStop(0, isMeteor ? 'rgba(255, 140, 0, 0.18)' : 'rgba(245, 158, 11, 0.12)');
    rightAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightAura;
    ctx.beginPath();
    ctx.arc(cx + 85, cy + 15, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 5. Clean, Minimalist Perspective Ring Guides (Whisper-soft cosmic rings)
    const bgRings = [40, 80, 130, 190, 260, 340];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (const r of bgRings) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Parallax Cosmic Stardust Radiating from Singularity
    for (const d of this.dust) {
      const pAngle = (d.x / width) * Math.PI * 2;
      const pDist = ((d.y + this.cameraY * 0.28 * d.speed) % 360) + 16;
      const px = cx + Math.cos(pAngle) * pDist;
      const py = cy + Math.sin(pAngle) * pDist * 0.85;

      ctx.fillStyle = isMeteor ? '#ffaa00' : (pDist > 160 ? '#67e8f9' : '#ffffff');
      ctx.globalAlpha = Math.min(1, d.baseAlpha * (pDist / 220));
      ctx.beginPath();
      ctx.arc(px, py, d.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 7. Center Galactic Singularity Core (Ethereal Horizon Flare)
    const corePulse = 1 + 0.1 * Math.sin(this.pulseTimer * 1.6);
    const flareRadius = 75 * corePulse;
    const singularityGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, flareRadius);
    if (isMeteor) {
      singularityGlow.addColorStop(0, '#ffffff');
      singularityGlow.addColorStop(0.2, '#ffe600');
      singularityGlow.addColorStop(0.5, 'rgba(255, 68, 0, 0.7)');
      singularityGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      singularityGlow.addColorStop(0, '#ffffff');
      singularityGlow.addColorStop(0.12, '#93c5fd');
      singularityGlow.addColorStop(0.38, 'rgba(168, 85, 247, 0.6)');
      singularityGlow.addColorStop(0.72, 'rgba(99, 102, 241, 0.2)');
      singularityGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = singularityGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, flareRadius, 0, Math.PI * 2);
    ctx.fill();

    // Central core sparkle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 * corePulse, 0, Math.PI * 2);
    ctx.fill();

    // Subtle stellar needles
    ctx.strokeStyle = isMeteor ? 'rgba(255, 200, 100, 0.45)' : 'rgba(216, 180, 254, 0.45)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const rayAngle = (k * Math.PI) / 4 + this.pulseTimer * 0.12;
      const rayLen = 22 * corePulse;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(rayAngle) * rayLen, cy - Math.sin(rayAngle) * rayLen);
      ctx.lineTo(cx + Math.cos(rayAngle) * rayLen, cy + Math.sin(rayAngle) * rayLen);
      ctx.stroke();
    }

    ctx.restore();

    // Dynamic speed warp lines (only during fast falls or Meteor mode)
    if (isMeteor) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 50 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    } else if (isFallingFast) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 30 + Math.random() * 50;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
