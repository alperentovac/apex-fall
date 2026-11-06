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

  // Pointer drag state
  private isPointerDown = false;
  private lastPointerX = 0;

  // Keyboard controls
  private keys: { [key: string]: boolean } = {};

  // Device Tilt (Gyroscope) controls
  private isTiltEnabled = false;
  private tiltDir = 0;

  // DOM Elements
  private hudDepth: HTMLElement;
  private hudBest: HTMLElement;
  private hudMultiplier: HTMLElement;
  private hudGems: HTMLElement;
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
    this.btnTilt = document.getElementById('btn-tilt')!;
    this.meteorLabel = document.getElementById('meteor-label')!;
    this.dot1 = document.getElementById('dot-1')!;
    this.dot2 = document.getElementById('dot-2')!;
    this.dot3 = document.getElementById('dot-3')!;
    this.screenMsg = document.getElementById('screen-msg')!;

    const savedBest = parseInt(localStorage.getItem('vortex_best_depth') || '0', 10);

    this.player = {
      x: this.physics.worldWidth / 2,
      y: 90,
      vy: 280,
      radius: 13,
      consecutiveGaps: 0,
      isMeteor: false,
      meteorTimer: 0,
      cylinderRotation: 0,
      rotationVelocity: 0,
      tiltAngle: 0,
      scaleX: 1,
      scaleY: 1,
      currentDepth: 0,
      maxDepthAchieved: savedBest,
      score: 0,
      totalGems: 0,
      comboMultiplier: 1.0,
      isFallingFast: false,
      trailHistory: []
    };

    this.setupResize();
    this.setupInputs();
    this.showStartScreen();

    // Start render loop
    requestAnimationFrame(this.loop.bind(this));
  }

  private setupResize(): void {
    const resize = () => {
      const container = document.getElementById('game-container')!;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();
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
      this.lastPointerX = getClientX(e);
      this.player.rotationVelocity = 0;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      const clientX = getClientX(e);
      const deltaX = clientX - this.lastPointerX;
      this.lastPointerX = clientX;

      // Rotate cylinder smoothly
      const rotSpeedFactor = 0.013;
      this.physics.applyRotation(this.player, deltaX * rotSpeedFactor);
      this.player.rotationVelocity = deltaX * 0.9;
    };

    const handlePointerUp = () => {
      this.isPointerDown = false;
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    // Keyboard support (A / D, Left / Right)
    window.addEventListener('keydown', (e) => {
      sound.init();
      this.keys[e.code] = true;

      if ((e.code === 'KeyR' || e.code === 'Space') && (this.state === 'START' || this.state === 'CRASHED')) {
        this.startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Tilt (Gyroscope) toggle
    this.btnTilt.addEventListener('click', () => {
      this.toggleTilt();
    });

    // Device orientation event listener
    window.addEventListener('deviceorientation', (e) => {
      if (this.isTiltEnabled && e.gamma !== null) {
        const deadzone = 3.5;
        if (Math.abs(e.gamma) > deadzone) {
          const clamped = Math.max(-40, Math.min(40, e.gamma));
          this.tiltDir = clamped / 40;
        } else {
          this.tiltDir = 0;
        }
      }
    });
  }

  private toggleTilt(): void {
    if (!this.isTiltEnabled) {
      // Check iOS 13+ permission
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
      this.tiltDir = 0;
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
      <div style="background: rgba(10, 5, 24, 0.9); border: 2px solid #00f0ff; border-radius: 18px; padding: 24px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.45);">
        <h1 style="font-family: 'Orbitron'; font-size: 34px; color: #00f0ff; text-shadow: 0 0 15px #00f0ff; margin-bottom: 2px;">VORTEX DIVE</h1>
        <p style="color: #ff007f; font-weight: 700; letter-spacing: 2px; font-size: 13px;">INFINITE NEON FREEFALL</p>
        <div style="margin: 16px 0; font-size: 14px; color: #b0c6e8; line-height: 1.7;">
          🌀 <b>Sürükle / A-D:</b> Halkaları Döndür<br>
          ⚡ <b>Boşluklardan Düş:</b> Derinliğe Plonjon Yap<br>
          🔥 <b>3 Halka Geç:</b> Meteor Ateşiyle Engelleri Parçala!
        </div>
        <button class="btn-action pulse" id="btn-start">DALIŞA BAŞLA</button>
      </div>
    `;

    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private showCrashScreen(): void {
    this.juice.addShake(25, 0.5);
    this.screenMsg.innerHTML = `
      <div style="background: rgba(35, 5, 18, 0.94); border: 2px solid #ff0055; border-radius: 18px; padding: 24px; box-shadow: 0 0 40px rgba(255, 0, 85, 0.6);">
        <h2 style="font-family: 'Orbitron'; font-size: 32px; color: #ff0055; text-shadow: 0 0 15px #ff0055; margin-bottom: 2px;">PARÇALANDIN!</h2>
        <p style="color: #00f0ff; font-weight: 800; font-size: 22px; margin: 10px 0;">${this.player.currentDepth}M DERİNLİK</p>
        <p style="color: #ffaa00; font-weight: 700; font-size: 15px; margin-bottom: 14px;">SKOR: ${this.player.score}</p>
        <button class="btn-action pulse" id="btn-restart" style="background: linear-gradient(135deg, #ff0055, #ffaa00);">TEKRAR DIVE [R]</button>
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

    this.player.y = 80;
    this.player.vy = 280;
    this.player.consecutiveGaps = 0;
    this.player.isMeteor = false;
    this.player.cylinderRotation = 0;
    this.player.rotationVelocity = 0;
    this.player.currentDepth = 0;
    this.player.score = 0;
    this.player.totalGems = 0;
    this.player.comboMultiplier = 1.0;
    this.player.isFallingFast = false;
    this.player.trailHistory = [];
  }

  private update(dt: number): void {
    // Keyboard steering
    let steerDir = 0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) steerDir += 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) steerDir -= 1;

    // Gyroscope tilt steering
    if (this.isTiltEnabled && Math.abs(this.tiltDir) > 0.05) {
      steerDir -= this.tiltDir * 1.5;
    }

    if (steerDir !== 0) {
      this.physics.applySteering(this.player, steerDir, dt);
    }

    // Inertial flick momentum decay
    if (!this.isPointerDown && Math.abs(this.player.rotationVelocity) > 0.05) {
      this.physics.applyRotation(this.player, this.player.rotationVelocity * dt);
      this.player.rotationVelocity *= Math.pow(0.85, dt * 60);
    }

    if (this.state === 'PLAYING') {
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
          this.juice.addShake(6, 0.12);
        },
        () => {
          this.juice.addShake(18, 0.35);
        },
        () => {
          this.juice.addShake(5, 0.1);
        }
      );

      // Best record update
      if (this.player.currentDepth > this.player.maxDepthAchieved) {
        this.player.maxDepthAchieved = this.player.currentDepth;
        localStorage.setItem('vortex_best_depth', this.player.maxDepthAchieved.toString());
      }
    }

    this.particles.update(dt);
    this.juice.update(dt, this.player.y, this.canvas.clientHeight, this.player.isFallingFast);

    // Update HUD
    this.hudDepth.textContent = `${this.player.currentDepth}M`;
    this.hudBest.textContent = `BEST ${this.player.maxDepthAchieved}M`;
    this.hudMultiplier.textContent = `x${this.player.comboMultiplier.toFixed(1)}`;
    this.hudGems.textContent = `💎 ${this.player.score}`;

    // Update Meteor dots & status
    const gaps = this.player.consecutiveGaps;
    const isMeteor = this.player.isMeteor;

    this.dot1.className = `dot ${gaps >= 1 ? (isMeteor ? 'fire' : 'active') : ''}`;
    this.dot2.className = `dot ${gaps >= 2 ? (isMeteor ? 'fire' : 'active') : ''}`;
    this.dot3.className = `dot ${gaps >= 3 ? 'fire' : ''}`;

    if (isMeteor) {
      this.meteorLabel.textContent = '🔥 METEOR SMASH!';
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

    // Dynamic 2.5D background tunnel
    this.juice.drawBackground(
      this.ctx,
      width,
      height,
      this.player.currentDepth,
      this.player.isFallingFast,
      this.player.comboMultiplier,
      this.player.isMeteor
    );

    // World transform
    this.ctx.save();
    const scale = width / this.physics.worldWidth;
    this.ctx.scale(scale, scale);
    this.ctx.translate(this.juice.shakeOffsetX, -this.juice.cameraY + this.juice.shakeOffsetY);

    // Draw rings & gems in 2.5D perspective
    this.world.draw(this.ctx, this.juice.cameraY, height / scale, this.player.cylinderRotation);

    // Draw aerodynamic dive trail
    for (const t of this.player.trailHistory) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, t.alpha);
      this.ctx.fillStyle = t.isMeteor ? '#ff5500' : '#00f0ff';
      this.ctx.shadowBlur = t.isMeteor ? 18 : 10;
      this.ctx.shadowColor = t.isMeteor ? '#ff0055' : '#00f0ff';

      const tr = this.player.radius * t.scale * (t.isMeteor ? 1.2 : 0.85);
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Player Cyber Orb
    this.drawPlayer();

    // Draw particles and floating texts
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }

  private drawPlayer(): void {
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.scale(this.player.scaleX, this.player.scaleY);

    const isMeteor = this.player.isMeteor;

    // Glowing outer aura
    this.ctx.shadowBlur = isMeteor ? 30 : 16;
    this.ctx.shadowColor = isMeteor ? '#ff0055' : '#00f0ff';

    // Body
    this.ctx.fillStyle = isMeteor ? '#ff3300' : '#00e5ff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner bright core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.player.radius * 0.45, 0, Math.PI * 2);
    this.ctx.fill();

    // Aerodynamic directional nose tip pointing down
    ctxTriangle(this.ctx, 0, this.player.radius * 0.9, 6, isMeteor ? '#ffff00' : '#00f0ff');

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

// Boot game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
