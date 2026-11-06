import { GameState, Player } from './types';
import { PhysicsEngine } from './engine/physics';
import { WorldManager } from './engine/world';
import { ParticleManager } from './engine/particles';
import { JuiceManager } from './engine/juice';
import { sound } from './engine/audio';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private physics: PhysicsEngine;
  private world: WorldManager;
  private particles: ParticleManager;
  private juice: JuiceManager;

  private state: GameState = 'START';
  private player: Player;
  private lastTime = 0;

  // Discrete 120-degree step rotation state
  private targetRotation = 0;
  private pointerStartX = 0;
  private pointerStartTime = 0;
  private isPointerDown = false;
  private swipeThreshold = 36;
  private guidePulseTimer = 0;

  // Device Tilt (Gyroscope) controls (Inverted per user request)
  private isTiltEnabled = false;
  private tiltCooldown = 0;

  // DOM Elements
  private hudDepth: HTMLElement;
  private hudBest: HTMLElement;
  private hudMultiplier: HTMLElement;
  private hudGems: HTMLElement;
  private hudTimer: HTMLElement;
  private btnRestartTop: HTMLElement;
  private btnTilt: HTMLElement;
  private meteorLabel: HTMLElement;
  private dot1: HTMLElement;
  private dot2: HTMLElement;
  private dot3: HTMLElement;
  private screenMsg: HTMLElement;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.physics = new PhysicsEngine();
    this.world = new WorldManager();
    this.particles = new ParticleManager();
    this.juice = new JuiceManager(this.physics.worldWidth, window.innerHeight);

    this.hudDepth = document.getElementById('hud-depth')!;
    this.hudBest = document.getElementById('hud-best')!;
    this.hudMultiplier = document.getElementById('hud-multiplier')!;
    this.hudGems = document.getElementById('hud-gems')!;
    this.hudTimer = document.getElementById('hud-timer')!;
    this.btnRestartTop = document.getElementById('btn-restart-top')!;
    this.btnTilt = document.getElementById('btn-tilt')!;
    this.meteorLabel = document.getElementById('meteor-label')!;
    this.dot1 = document.getElementById('dot-1')!;
    this.dot2 = document.getElementById('dot-2')!;
    this.dot3 = document.getElementById('dot-3')!;
    this.screenMsg = document.getElementById('screen-msg')!;

    const savedBest = parseInt(localStorage.getItem('apex_best_depth') || '0', 10);

    this.player = {
      x: this.physics.worldWidth / 2,
      y: 90,
      vy: 190,
      radius: 12,
      consecutiveGaps: 0,
      isMeteor: false,
      meteorTimer: 0,
      meteorMaxTimer: 4.0,
      meteorSmashesRemaining: 0,
      cylinderRotation: 0,
      rotationVelocity: 0,
      tiltAngle: 0,
      scaleX: 1,
      scaleY: 1,
      colorThemeIndex: 0,
      currentDepth: 0,
      maxDepthAchieved: savedBest,
      score: 0,
      totalGems: 0,
      comboMultiplier: 1.0,
      perfectDropStreak: 0,
      roundTimeRemaining: 25.0,
      roundTimeTotal: 30.0,
      isFallingFast: false,
      trailHistory: []
    };

    this.setupResize();
    this.setupInputs();
    this.showStartScreen();

    requestAnimationFrame(this.loop.bind(this));
  }

  // Mobile optimization: DPR capped to 1.5 to eliminate mobile GPU lag
  private setupResize(): void {
    const resize = () => {
      const container = document.getElementById('game-container')!;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();
  }

  // Tri-Sector: 120-degree rhythmic step rotation
  private snapStep(direction: number): void {
    if (this.state !== 'PLAYING') return;
    this.hideTapHints();
    this.targetRotation += direction * ((Math.PI * 2) / 3);
    sound.playSnapClick();
    this.juice.addShake(2, 0.08);
  }

  private hideTapHints(): void {
    const hints = document.getElementById('tap-hints');
    if (hints && !hints.classList.contains('hidden')) {
      hints.classList.add('hidden');
    }
  }

  private setupInputs(): void {
    const getClientX = (e: MouseEvent | TouchEvent): number => {
      return 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      sound.init();
      if (this.state === 'START' || this.state === 'CRASHED') {
        this.startGame();
        return;
      }

      this.isPointerDown = true;
      this.pointerStartX = getClientX(e);
      this.pointerStartTime = Date.now();
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown || this.state !== 'PLAYING') return;
      const clientX = getClientX(e);
      const deltaX = clientX - this.pointerStartX;

      // Swiping across threshold triggers discrete 90° snap
      if (Math.abs(deltaX) >= this.swipeThreshold) {
        this.snapStep(deltaX > 0 ? 1 : -1);
        this.pointerStartX = clientX;
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      // Quick tap on left/right half of screen
      const elapsed = Date.now() - this.pointerStartTime;
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const dist = Math.abs(clientX - this.pointerStartX);

      if (elapsed < 320 && dist < 25 && this.state === 'PLAYING') {
        const rect = this.canvas.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (clientX < midX) {
          this.snapStep(-1); // Tap left half = Step Left (90°)
        } else {
          this.snapStep(1);  // Tap right half = Step Right (90°)
        }
      }
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    // Top restart icon
    this.btnRestartTop.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startGame();
    });

    // Keyboard support: A / Left Arrow = Step Left, D / Right Arrow = Step Right
    window.addEventListener('keydown', (e) => {
      sound.init();

      if ((e.code === 'KeyR' || e.code === 'Enter') && (this.state === 'START' || this.state === 'CRASHED')) {
        this.startGame();
        return;
      }

      if (e.code === 'KeyR') {
        this.startGame();
        return;
      }

      if (this.state === 'PLAYING') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.snapStep(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.snapStep(1);
        }
      }
    });

    // Inverted Tilt toggle
    this.btnTilt.addEventListener('click', () => {
      this.toggleTilt();
    });

    window.addEventListener('deviceorientation', (e) => {
      if (this.isTiltEnabled && e.gamma !== null && this.state === 'PLAYING') {
        const threshold = 18;
        if (this.tiltCooldown <= 0) {
          if (e.gamma < -threshold) {
            this.snapStep(1); // Inverted: left tilt snaps right
            this.tiltCooldown = 0.28;
          } else if (e.gamma > threshold) {
            this.snapStep(-1); // Inverted: right tilt snaps left
            this.tiltCooldown = 0.28;
          }
        }
      }
    });
  }

  private toggleTilt(): void {
    if (!this.isTiltEnabled) {
      const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }).requestPermission;
      if (typeof req === 'function') {
        req()
          .then((response) => {
            if (response === 'granted') {
              this.isTiltEnabled = true;
              this.updateTiltButton();
            }
          })
          .catch(() => {});
      } else {
        this.isTiltEnabled = true;
        this.updateTiltButton();
      }
    } else {
      this.isTiltEnabled = false;
      this.updateTiltButton();
    }
  }

  private updateTiltButton(): void {
    if (this.isTiltEnabled) {
      this.btnTilt.textContent = '📱 TİLT: AÇIK';
      this.btnTilt.classList.add('active');
    } else {
      this.btnTilt.textContent = '📱 TİLT: KAPALI';
      this.btnTilt.classList.remove('active');
    }
  }

  private showStartScreen(): void {
    this.screenMsg.innerHTML = `
      <div style="background: rgba(10, 4, 22, 0.94); border: 2px solid #00f0ff; border-radius: 18px; padding: 22px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.4);">
        <h1 style="font-family: 'Orbitron'; font-size: 30px; color: #00f0ff; text-shadow: 0 0 14px #00f0ff; margin-bottom: 2px;">APEX FALL</h1>
        <p style="color: #ff007f; font-weight: 700; letter-spacing: 2px; font-size: 13px;">AKIŞKAN DİKEY SÖRF (SEÇENEK 3)</p>
        <div style="margin: 15px 0; font-size: 14px; color: #b6ccf0; line-height: 1.8;">
          👈 <b>Sola Dokun / A:</b> Sola 120° Çevir<br>
          👉 <b>Sağa Dokun / D:</b> Sağa 120° Çevir<br>
          ⚡ <b>Kesintisiz Ritim:</b> Deliklerden ak, piyano akorlarını yakala!<br>
          💥 <b>DİKKAT:</b> Kapalı engele çarparsan oyun biter!<br>
          🐱 <b>3 Seri Delik:</b> Kedi Müziği ile Meteor Crush (+2.5s)!
        </div>
        <button class="btn-action pulse" id="btn-start">BAŞLA</button>
      </div>
    `;

    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private showCrashScreen(): void {
    this.juice.addShake(25, 0.5);
    this.screenMsg.innerHTML = `
      <div style="background: rgba(30, 4, 15, 0.96); border: 2px solid #ff0055; border-radius: 18px; padding: 22px; box-shadow: 0 0 35px rgba(255, 0, 85, 0.6);">
        <h2 style="font-family: 'Orbitron'; font-size: 26px; color: #ff0055; text-shadow: 0 0 14px #ff0055; margin-bottom: 2px;">💥 ENGELE ÇARPTIN!</h2>
        <p style="color: #00f0ff; font-weight: 800; font-size: 24px; margin: 8px 0;">${this.player.currentDepth}M DERİNLİK</p>
        <p style="color: #ffe600; font-weight: 700; font-size: 16px; margin-bottom: 6px;">SKOR: ${this.player.score}</p>
        <p style="color: #b6ccf0; font-size: 13px; margin-bottom: 14px;">GEÇİLEN DELİK: ${this.player.perfectDropStreak}</p>
        <button class="btn-action pulse" id="btn-restart" style="background: linear-gradient(135deg, #ff0055, #00f0ff); font-weight: 900;">TEKRAR DALIŞ YAP [R]</button>
      </div>
    `;

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private showTimeoutScreen(): void {
    this.juice.addShake(16, 0.35);
    sound.stopCatMusic();
    this.screenMsg.innerHTML = `
      <div style="background: rgba(22, 6, 32, 0.96); border: 2px solid #ffe600; border-radius: 18px; padding: 22px; box-shadow: 0 0 35px rgba(255, 230, 0, 0.5);">
        <h2 style="font-family: 'Orbitron'; font-size: 26px; color: #ffe600; text-shadow: 0 0 14px #ffe600; margin-bottom: 4px;">⏱️ SÜRE DOLDU!</h2>
        <p style="color: #00f0ff; font-weight: 800; font-size: 24px; margin: 8px 0;">${this.player.currentDepth}M DERİNLİK</p>
        <p style="color: #39ff14; font-weight: 700; font-size: 16px; margin-bottom: 4px;">SKOR: ${this.player.score}</p>
        <p style="color: #b6ccf0; font-size: 13px; margin-bottom: 14px;">GEÇİLEN DELİK: ${this.player.perfectDropStreak}</p>
        <button class="btn-action pulse" id="btn-restart" style="background: linear-gradient(135deg, #ffe600, #ff007f); color: #000; font-weight: 900;">TEKRAR DALIŞ YAP [R]</button>
      </div>
    `;

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private startGame(): void {
    sound.init();
    this.state = 'PLAYING';
    this.screenMsg.innerHTML = '';

    this.world.reset();
    this.particles.clear();

    this.targetRotation = 0;
    this.player.y = 90;
    this.player.vy = 260;
    this.player.roundTimeRemaining = 25.0;
    this.player.roundTimeTotal = 30.0;
    this.player.consecutiveGaps = 0;
    this.player.isMeteor = false;
    this.player.meteorTimer = 0;
    this.player.meteorSmashesRemaining = 0;
    this.player.cylinderRotation = 0;
    this.player.rotationVelocity = 0;
    this.player.currentDepth = 0;
    this.player.score = 0;
    this.player.totalGems = 0;
    this.player.comboMultiplier = 1.0;
    this.player.perfectDropStreak = 0;
    this.player.colorThemeIndex = 0;
    this.player.isFallingFast = false;
    this.player.trailHistory = [];
  }

  private update(dt: number): void {
    if (this.tiltCooldown > 0) {
      this.tiltCooldown -= dt;
    }
    this.guidePulseTimer += dt * 8;

    // Smooth snappy 120° magnetic interpolation
    const rotDiff = this.targetRotation - this.player.cylinderRotation;
    this.player.cylinderRotation += rotDiff * Math.min(1, dt * 34);

    if (this.state === 'PLAYING') {
      this.player.roundTimeRemaining -= dt;
      if (this.player.roundTimeRemaining <= 0) {
        this.player.roundTimeRemaining = 0;
        this.state = 'CRASHED';
        this.showTimeoutScreen();
        return;
      }

      this.world.update(dt, this.juice.cameraY);

      this.physics.update(
        dt,
        this.player,
        this.world.rings,
        this.world.gems,
        this.particles,
        () => {
          this.state = 'CRASHED';
          this.showCrashScreen();
        },
        () => {
          this.juice.addShake(4, 0.08);
        },
        () => {
          this.juice.addShake(16, 0.3);
        }
      );

      if (this.player.currentDepth > this.player.maxDepthAchieved) {
        this.player.maxDepthAchieved = this.player.currentDepth;
        localStorage.setItem('apex_best_depth', this.player.maxDepthAchieved.toString());
      }
    }

    this.particles.update(dt);
    this.juice.update(dt, this.player.y, this.canvas.clientHeight, this.player.isFallingFast);

    // Update HUD
    this.hudDepth.textContent = `${this.player.currentDepth}M`;
    this.hudBest.textContent = `BEST ${this.player.maxDepthAchieved}M`;
    this.hudMultiplier.textContent = `x${this.player.comboMultiplier.toFixed(1)}`;
    this.hudGems.textContent = `💎 ${this.player.score}`;
    this.hudTimer.textContent = `⏱️ ${Math.max(0, this.player.roundTimeRemaining).toFixed(1)}s`;
    if (this.player.roundTimeRemaining <= 5.0) {
      this.hudTimer.classList.add('urgent');
    } else {
      this.hudTimer.classList.remove('urgent');
    }

    // Update Meteor indicators
    const gaps = this.player.consecutiveGaps;
    const isMeteor = this.player.isMeteor;

    this.dot1.className = `dot ${gaps >= 1 ? (isMeteor ? 'fire' : 'active') : ''}`;
    this.dot2.className = `dot ${gaps >= 2 ? (isMeteor ? 'fire' : 'active') : ''}`;
    this.dot3.className = `dot ${gaps >= 3 ? 'fire' : ''}`;

    if (isMeteor) {
      const remainingSec = Math.max(0, this.player.meteorTimer).toFixed(1);
      this.meteorLabel.textContent = `🐱 METEOR! (${remainingSec}s)`;
      this.meteorLabel.style.color = '#ff0055';
    } else {
      this.meteorLabel.textContent = `METEOR STREAK (${Math.min(gaps, 3)}/3)`;
      this.meteorLabel.style.color = '#ffaa00';
    }
  }

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    this.juice.drawBackground(
      this.ctx,
      width,
      height,
      this.player.currentDepth,
      this.player.isFallingFast,
      this.player.comboMultiplier,
      this.player.isMeteor,
      this.player.colorThemeIndex
    );

    this.ctx.save();
    const scale = width / this.physics.worldWidth;
    this.ctx.scale(scale, scale);
    this.ctx.translate(this.juice.shakeOffsetX, -this.juice.cameraY + this.juice.shakeOffsetY);

    // Draw rings & gems in 2.5D perspective
    this.world.draw(
      this.ctx,
      this.juice.cameraY,
      height / scale,
      this.player.cylinderRotation,
      this.player.colorThemeIndex
    );

    // Draw Smart Directional Guidance Arrows (Tells the player exact rotation needed!)
    this.drawSmartDirectionalGuidance();

    // Draw aerodynamic dive trail
    for (const t of this.player.trailHistory) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, t.alpha * 0.7);
      this.ctx.fillStyle = t.isMeteor ? '#ff5500' : '#00f0ff';
      const tr = this.player.radius * t.scale * (t.isMeteor ? 1.2 : 0.85);
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Player
    this.drawPlayer();

    // Draw particles
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }

  // Option A: Smart Directional Guidance (◀ SOLA / SAĞA ▶ / ▼ DÜŞÜŞ)
  private drawSmartDirectionalGuidance(): void {
    const upcomingRing = this.world.rings.find((r) => !r.isBroken && r.y > this.player.y);
    if (!upcomingRing) return;

    const guide = this.physics.getGuideDirection(this.player, upcomingRing);
    const pulse = 0.75 + 0.25 * Math.sin(this.guidePulseTimer);

    this.ctx.save();
    const px = this.player.x;
    const py = this.player.y;
    const targetY = upcomingRing.y;

    if (guide.step === 0) {
      // 1. ALIGNED WITH GAP! (Luminous green laser lane)
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = `rgba(57, 255, 20, ${pulse})`;
      this.ctx.setLineDash([6, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(px, py + this.player.radius + 4);
      this.ctx.lineTo(px, targetY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Green target reticle
      this.ctx.fillStyle = '#39ff14';
      this.ctx.beginPath();
      this.ctx.arc(px, targetY, 5 * pulse, 0, Math.PI * 2);
      this.ctx.fill();

      // Downward chevron
      this.ctx.font = '900 12px "Orbitron", monospace';
      this.ctx.fillStyle = `rgba(57, 255, 20, ${pulse})`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText('▼ DÜŞÜŞ ▼', px, py + this.player.radius + 20);
    } else if (guide.step === -1) {
      // 2. TURN LEFT! (Pulsing neon chevron on the left)
      const arrowX = px - 55 - (1 - pulse) * 8;
      this.ctx.font = '900 18px "Orbitron", monospace';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('◀◀', arrowX, py + 5);

      this.ctx.font = '800 10px "Orbitron", monospace';
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
      this.ctx.fillText('SOL', arrowX, py + 18);
    } else if (guide.step === 1) {
      // 3. TURN RIGHT! (Pulsing neon chevron on the right)
      const arrowX = px + 55 + (1 - pulse) * 8;
      this.ctx.font = '900 18px "Orbitron", monospace';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('▶▶', arrowX, py + 5);

      this.ctx.font = '800 10px "Orbitron", monospace';
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
      this.ctx.fillText('SAĞ', arrowX, py + 18);
    }

    this.ctx.restore();
  }

  private drawPlayer(): void {
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.scale(this.player.scaleX, this.player.scaleY);

    const isMeteor = this.player.isMeteor;

    // Body
    this.ctx.fillStyle = isMeteor ? '#ff3300' : '#00e5ff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Bright inner core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.player.radius * 0.45, 0, Math.PI * 2);
    this.ctx.fill();

    // Downward nose tip
    ctxTriangle(this.ctx, 0, this.player.radius * 0.9, 5, isMeteor ? '#ffff00' : '#00f0ff');

    this.ctx.restore();
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }
}

function ctxTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x - size, y - size);
  ctx.lineTo(x + size, y - size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
