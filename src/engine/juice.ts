interface Building {
  x: number;
  width: number;
  height: number;
  windows: Array<{ x: number; y: number; color: string }>;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  maxLife: number;
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

  // Parallax scenery
  private stars: Array<{ x: number; y: number; size: number; baseAlpha: number }> = [];
  private buildings: Building[] = [];
  private shootingStars: ShootingStar[] = [];
  private pulseTimer = 0;

  constructor(worldWidth: number, screenHeight: number) {
    // Background stars
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight * 4,
        size: 1 + Math.random() * 2.5,
        baseAlpha: 0.2 + Math.random() * 0.7
      });
    }

    // Procedural Cyberpunk Buildings for lower floors (0-20)
    let curX = 0;
    while (curX < worldWidth + 80) {
      const bWidth = 35 + Math.random() * 55;
      const bHeight = 160 + Math.random() * 240;
      const bWindows: Array<{ x: number; y: number; color: string }> = [];

      // Windows grid
      for (let wy = 15; wy < bHeight - 15; wy += 14) {
        for (let wx = 6; wx < bWidth - 8; wx += 10) {
          if (Math.random() < 0.65) {
            const colors = ['#00f0ff', '#ff00aa', '#ffea00', '#00ff88'];
            bWindows.push({
              x: wx,
              y: wy,
              color: colors[Math.floor(Math.random() * colors.length)]
            });
          }
        }
      }

      this.buildings.push({
        x: curX,
        width: bWidth,
        height: bHeight,
        windows: bWindows
      });
      curX += bWidth + (Math.random() * 8);
    }
  }

  public addShake(magnitude = 10, duration = 0.25): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  public update(dt: number, playerY: number, screenHeight: number, isFallingFast: boolean): void {
    this.targetCameraY = playerY - screenHeight * 0.62;

    const lerpSpeed = isFallingFast ? 26 : 16;
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

    // Occasional shooting stars in upper stratosphere
    if (Math.random() < 0.02) {
      this.shootingStars.push({
        x: Math.random() * 480,
        y: Math.random() * 250,
        vx: 350 + Math.random() * 300,
        vy: 200 + Math.random() * 200,
        len: 40 + Math.random() * 50,
        life: 0.6,
        maxLife: 0.6
      });
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.shootingStars.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  }

  public drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFloor: number,
    isFallingFast: boolean,
    comboMultiplier: number,
    isOverdriveActive: boolean = false,
    isFlowActive: boolean = false
  ): void {
    // 1. Dynamic Atmosphere Sky
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (currentFloor < 12) {
      // Lower City: Deep Neon Midnight
      gradient.addColorStop(0, '#120b28');
      gradient.addColorStop(0.65, '#1e0c38');
      gradient.addColorStop(1, '#080512');
    } else if (currentFloor < 30) {
      // Mid Tower: Retro Sunset Glow
      gradient.addColorStop(0, '#26043d');
      gradient.addColorStop(0.45, '#6b1156');
      gradient.addColorStop(0.85, '#ff4444');
      gradient.addColorStop(1, '#0e031a');
    } else {
      // Cosmic Stratosphere
      gradient.addColorStop(0, '#010f24');
      gradient.addColorStop(0.5, '#051938');
      gradient.addColorStop(1, '#02050f');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Retro Striped Synthwave Sun (Visible around mid-tier climb)
    if (currentFloor >= 4 && currentFloor <= 45) {
      const sunY = height * 0.45 + (this.cameraY * 0.06);
      const sunRadius = 75;

      ctx.save();
      // Sun outer glow
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#ffaa00';

      const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
      sunGrad.addColorStop(0, '#ffff55');
      sunGrad.addColorStop(0.5, '#ff0077');
      sunGrad.addColorStop(1, '#7700ff');
      ctx.fillStyle = sunGrad;

      ctx.beginPath();
      ctx.arc(width / 2, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal retro cut lines
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1e0c38';
      for (let ly = sunY - 10; ly < sunY + sunRadius; ly += 11) {
        const thickness = 2 + ((ly - (sunY - 10)) / sunRadius) * 4;
        ctx.fillRect((width / 2) - sunRadius - 10, ly, sunRadius * 2 + 20, thickness);
      }
      ctx.restore();
    }

    // 3. Synthwave Mountains (Mid-tier horizon)
    if (currentFloor >= 8 && currentFloor <= 40) {
      ctx.save();
      const mountY = height * 0.72 + (this.cameraY * 0.1);
      ctx.fillStyle = '#18072b';
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, mountY + 20);
      ctx.lineTo(width * 0.25, mountY - 45);
      ctx.lineTo(width * 0.5, mountY + 10);
      ctx.lineTo(width * 0.75, mountY - 60);
      ctx.lineTo(width, mountY - 10);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Neon mountain edge ridge
      ctx.strokeStyle = 'rgba(255, 0, 150, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Cyberpunk City Skyline (Lower floors 0-18)
    const cityOffset = 800 - (this.cameraY * 0.2);
    if (cityOffset > -300 && cityOffset < height + 400) {
      ctx.save();
      for (const b of this.buildings) {
        const by = cityOffset + (300 - b.height);
        ctx.fillStyle = '#0a0618';
        ctx.fillRect(b.x, by, b.width, b.height);

        // Building neon antenna
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width / 2, by);
        ctx.lineTo(b.x + b.width / 2, by - 16);
        ctx.stroke();

        // Windows
        for (const w of b.windows) {
          ctx.fillStyle = w.color;
          ctx.globalAlpha = 0.65;
          ctx.fillRect(b.x + w.x, by + w.y, 4.5, 6);
        }
      }
      ctx.restore();
    }

    // 5. Perspective Synthwave Grid & Rhythmic Pulse
    ctx.save();
    const pulseFactor = 0.05 + 0.03 * Math.sin(this.pulseTimer);
    ctx.strokeStyle = `rgba(0, 240, 255, ${pulseFactor})`;
    ctx.lineWidth = 1;

    const gridSpacing = 42;
    const offsetY = (-this.cameraY * 0.35) % gridSpacing;
    for (let y = offsetY; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 0; x <= width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Stars
    for (const star of this.stars) {
      const starY = (star.y - this.cameraY * 0.12) % height;
      const actualY = starY < 0 ? starY + height : starY;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = star.baseAlpha;
      ctx.fillRect(star.x, actualY, star.size, star.size);
    }

    // Shooting stars
    for (const s of this.shootingStars) {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = s.life / s.maxLife;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - (s.vx / 8), s.y - (s.vy / 8));
      ctx.stroke();
    }
    ctx.restore();

    // 6. Adrenaline & Flow State Vignettes
    if (isFlowActive) {
      // Golden / Electric rainbow flow border
      ctx.save();
      const flowVig = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.75
      );
      flowVig.addColorStop(0, 'rgba(255, 234, 0, 0)');
      flowVig.addColorStop(1, 'rgba(255, 234, 0, 0.28)');
      ctx.fillStyle = flowVig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (comboMultiplier > 2) {
      const glowAlpha = Math.min(0.38, (comboMultiplier - 2) * 0.05);
      const vig = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.35,
        width / 2, height / 2, height * 0.75
      );
      vig.addColorStop(0, 'rgba(255, 0, 128, 0)');
      vig.addColorStop(1, `rgba(255, 0, 128, ${glowAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    // 7. Hyper Rocket Overdrive Warp Lines
    if (isOverdriveActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.75)';
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

    // 8. Panic Falling Speed Lines
    if (isFallingFast) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 30, 60, 0.4)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 18; i++) {
        const lx = Math.random() * width;
        const ly = Math.random() * height;
        const len = 50 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
