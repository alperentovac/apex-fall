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
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private currentPointerX = 0;
  private currentPointerY = 0;

  // Keyboard input states
  private keys: { [key: string]: boolean } = {};
  private keyboardAimAngle = -Math.PI / 2; // Upward

  // DOM Elements
  private hudFloor: HTMLElement;
  private hudBest: HTMLElement;
  private hudMultiplier: HTMLElement;
  private hudSparks: HTMLElement;
  private tubeFill: HTMLElement;
  private tubeLabel: HTMLElement;
  private btnRocket: HTMLElement;
  private screenMsg: HTMLElement;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.physics = new PhysicsEngine();
    this.world = new WorldManager();
    this.particles = new ParticleManager();
    this.juice = new JuiceManager(this.physics.worldWidth, window.innerHeight);

    this.hudFloor = document.getElementById('hud-floor')!;
    this.hudBest = document.getElementById('hud-best')!;
    this.hudMultiplier = document.getElementById('hud-multiplier')!;
    this.hudSparks = document.getElementById('hud-sparks')!;
    this.tubeFill = document.getElementById('tube-fill')!;
    this.tubeLabel = document.getElementById('tube-label')!;
    this.btnRocket = document.getElementById('btn-rocket')!;
    this.screenMsg = document.getElementById('screen-msg')!;

    // Load best floor from localStorage
    const savedBest = parseInt(localStorage.getItem('apex_best_floor') || '0', 10);

    this.player = {
      x: this.physics.worldWidth / 2,
      y: this.world.groundY - 18,
      vx: 0,
      vy: 0,
      width: 26,
      height: 26,
      onGround: true,
      groundPlatformId: 1,
      rotation: 0,
      isCharging: false,
      charge: 0,
      aimAngle: -Math.PI / 2,
      aimLength: 0,
      hasAirJump: true,
      scaleX: 1,
      scaleY: 1,
      overdriveEnergy: 0,
      isOverdriveActive: false,
      overdriveTimer: 0,
      currentFloor: 0,
      maxFloorAchieved: savedBest,
      totalSparks: 0,
      currentRunSparks: 0,
      comboMultiplier: 1.0,
      comboStreak: 0,
      isFallingFast: false,
      fallStartY: this.world.groundY,
      fallDistance: 0,
      maxFallRecorded: 0,
      trailHistory: []
    };

    this.setupResize();
    this.setupInputs();
    this.showStartScreen();

    // Start loop
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
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const scaleX = this.physics.worldWidth / rect.width;
      return {
        x: (clientX - rect.left) * scaleX,
        y: clientY - rect.top + this.juice.cameraY
      };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      sound.init();
      if (this.state === 'START' || this.state === 'CRASHED') {
        this.startGame();
        return;
      }

      // Air Boost / Double Jump in mid-air
      if (!this.player.onGround) {
        if (this.physics.triggerAirJump(this.player, this.particles)) {
          this.juice.addShake(8, 0.18);
        }
        return;
      }

      this.isPointerDown = true;
      const pos = getPos(e);
      this.pointerStartX = pos.x;
      this.pointerStartY = pos.y;
      this.currentPointerX = pos.x;
      this.currentPointerY = pos.y;
      this.player.isCharging = true;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      const pos = getPos(e);
      this.currentPointerX = pos.x;
      this.currentPointerY = pos.y;

      // Snappy slingshot aim vector (quicker charge curve)
      const dx = this.pointerStartX - this.currentPointerX;
      const dy = this.pointerStartY - this.currentPointerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Launch angle follows drag direction upwards
      let angle = Math.atan2(dy, dx);
      // Ensure mostly upward trajectory (-170 deg to -10 deg)
      if (angle > -0.15 && angle < Math.PI / 2) angle = -0.15;
      if (angle < -Math.PI + 0.15 || angle >= Math.PI / 2) angle = -Math.PI + 0.15;

      this.player.aimAngle = angle;
      // High-octane responsiveness: fills charge with a shorter, snappier flick
      this.player.charge = Math.min(1, Math.max(0.2, dist / 80));
    };

    const handlePointerUp = () => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      this.player.isCharging = false;

      if (this.player.onGround) {
        // Quick-tap instant jump support (Flappy Bird style rapid climb)
        const power = this.player.charge > 0.2 ? this.player.charge : 0.72;
        this.physics.launchJump(this.player, this.player.aimAngle, power, this.particles);
        this.juice.addShake(7, 0.15);
      }
      this.player.charge = 0;
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    // Rocket Button Click
    this.btnRocket.addEventListener('click', () => {
      if (this.physics.activateOverdrive(this.player, this.particles)) {
        this.juice.addShake(18, 0.4);
      }
    });

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      sound.init();
      this.keys[e.code] = true;

      if ((e.code === 'KeyR' || e.code === 'Space') && (this.state === 'START' || this.state === 'CRASHED')) {
        this.startGame();
        return;
      }

      if (e.code === 'KeyE') {
        if (this.physics.activateOverdrive(this.player, this.particles)) {
          this.juice.addShake(18, 0.4);
        }
      }

      if (e.code === 'Space') {
        if (!this.player.onGround) {
          // Mid-air quick flap/boost
          if (this.physics.triggerAirJump(this.player, this.particles)) {
            this.juice.addShake(8, 0.18);
          }
          return;
        }

        if (this.player.onGround && !this.player.isCharging) {
          this.player.isCharging = true;
          this.player.charge = 0.35;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'Space' && this.player.isCharging) {
        this.player.isCharging = false;
        if (this.player.onGround) {
          const power = Math.max(0.65, this.player.charge);
          this.physics.launchJump(this.player, this.keyboardAimAngle, power, this.particles);
          this.juice.addShake(7, 0.15);
        }
        this.player.charge = 0;
      }
    });
  }

  private showStartScreen(): void {
    this.screenMsg.innerHTML = `
      <div style="background: rgba(12, 8, 28, 0.88); border: 2px solid #00f0ff; border-radius: 16px; padding: 22px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.4);">
        <h1 style="font-family: 'Orbitron'; font-size: 32px; color: #00f0ff; text-shadow: 0 0 15px #00f0ff; margin-bottom: 2px;">APEX FALL</h1>
        <p style="color: #ff007f; font-weight: 700; letter-spacing: 2px; font-size: 13px;">RISK TOWER</p>
        <div style="margin: 14px 0; font-size: 14px; color: #9cb3d6; line-height: 1.6;">
          🎯 <b>Tıkla / Space:</b> Sıçra<br>
          ⚡ <b>Kristal Topla:</b> Çarpanı ve Roketi Doldur<br>
          🚀 <b>Overdrive [E]:</b> 20 Katı Delip Geç!
        </div>
        <button class="btn-action pulse" id="btn-start">BAŞLA</button>
      </div>
    `;

    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private showCrashScreen(floorsLost: number): void {
    this.juice.addShake(25, 0.55);
    this.screenMsg.innerHTML = `
      <div style="background: rgba(35, 5, 15, 0.92); border: 2px solid #ff0055; border-radius: 16px; padding: 22px; box-shadow: 0 0 40px rgba(255, 0, 85, 0.6);">
        <h2 style="font-family: 'Orbitron'; font-size: 30px; color: #ff0055; text-shadow: 0 0 15px #ff0055; margin-bottom: 2px;">ÇAKILDIN!</h2>
        <p style="color: #ffaa00; font-weight: 800; font-size: 20px; margin: 8px 0;">-${floorsLost}F KAYBEDİLDİ</p>
        <button class="btn-action pulse" id="btn-restart" style="background: linear-gradient(135deg, #ff0055, #ffaa00);">TEKRAR [R]</button>
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

    this.player.x = this.physics.worldWidth / 2;
    this.player.y = this.world.groundY - 18;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = true;
    this.player.hasAirJump = true;
    this.player.groundPlatformId = 1;
    this.player.currentFloor = 0;
    this.player.overdriveEnergy = 0;
    this.player.isOverdriveActive = false;
    this.player.overdriveTimer = 0;
    this.player.comboMultiplier = 1.0;
    this.player.comboStreak = 0;
    this.player.currentRunSparks = 0;
    this.player.isFallingFast = false;
    this.player.fallDistance = 0;
    this.player.trailHistory = [];
  }

  private update(dt: number): void {
    // Air control steering with keyboard
    let steerDir = 0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) steerDir -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) steerDir += 1;

    if (steerDir !== 0 && !this.player.onGround) {
      this.physics.applyAirControl(this.player, steerDir, dt);
    }

    // High-speed keyboard charge update
    if (this.player.onGround && this.player.isCharging && !this.isPointerDown) {
      this.player.charge = Math.min(1, this.player.charge + dt * 3.4);

      if (steerDir !== 0) {
        this.keyboardAimAngle += steerDir * dt * 4.2;
        this.keyboardAimAngle = Math.max(-Math.PI * 0.85, Math.min(-Math.PI * 0.15, this.keyboardAimAngle));
      }
      this.player.aimAngle = this.keyboardAimAngle;
    }

    if (this.state === 'PLAYING') {
      this.world.update(dt, this.juice.cameraY);

      this.physics.update(
        dt,
        this.player,
        this.world.platforms,
        this.world.gems,
        this.particles,
        (floorsLost) => {
          this.state = 'CRASHED';
          this.showCrashScreen(floorsLost);
        }
      );

      // Update best record
      if (this.player.currentFloor > this.player.maxFloorAchieved) {
        this.player.maxFloorAchieved = this.player.currentFloor;
        localStorage.setItem('apex_best_floor', this.player.maxFloorAchieved.toString());
      }
    }

    this.particles.update(dt);
    this.juice.update(dt, this.player.y, this.canvas.clientHeight, this.player.isFallingFast);

    // Update Minimalist HUD
    this.hudFloor.textContent = `${this.player.currentFloor}F`;
    this.hudBest.textContent = `BEST ${this.player.maxFloorAchieved}F`;
    this.hudMultiplier.textContent = `x${this.player.comboMultiplier.toFixed(1)}`;
    this.hudSparks.textContent = `💎 ${this.player.currentRunSparks}`;

    // Overdrive Tube & Button update
    const energyPct = Math.min(100, Math.max(0, this.player.overdriveEnergy));
    this.tubeFill.style.height = `${energyPct}%`;
    this.tubeLabel.textContent = `⚡${Math.round(energyPct)}%`;

    if (energyPct >= 100 || this.player.isOverdriveActive) {
      this.btnRocket.style.display = 'flex';
      this.tubeLabel.style.color = '#ff0055';
    } else {
      this.btnRocket.style.display = 'none';
      this.tubeLabel.style.color = '#ffaa00';
    }
  }

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    // Dynamic background with parallax & vignette
    this.juice.drawBackground(
      this.ctx,
      width,
      height,
      this.player.currentFloor,
      this.player.isFallingFast,
      this.player.comboMultiplier,
      this.player.isOverdriveActive
    );

    // World transform (Camera + Screen Shake)
    this.ctx.save();
    // Scale world coordinate (480 wide) to canvas width
    const scale = width / this.physics.worldWidth;
    this.ctx.scale(scale, scale);
    this.ctx.translate(this.juice.shakeOffsetX, -this.juice.cameraY + this.juice.shakeOffsetY);

    // Draw platforms & gems
    this.world.draw(this.ctx, this.juice.cameraY, height / scale);

    // Draw player trails
    for (const t of this.player.trailHistory) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, t.alpha);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.fillRect(t.x - (this.player.width * t.scale) / 2, t.y - this.player.height / 2, this.player.width * t.scale, this.player.height);
      this.ctx.restore();
    }

    // Draw Player
    this.drawPlayer();

    // Draw Trajectory Prediction Arc when charging
    if (this.player.onGround && this.player.isCharging && this.player.charge > 0.08) {
      this.drawTrajectory();
    }

    // Draw particles and floating texts
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }

  private drawPlayer(): void {
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.scale(this.player.scaleX, this.player.scaleY);

    // Outer glow aura
    this.ctx.shadowBlur = this.player.isOverdriveActive ? 28 : (this.player.comboMultiplier > 4 ? 18 : 14);
    this.ctx.shadowColor = this.player.isOverdriveActive ? '#ffaa00' : (this.player.comboMultiplier > 4 ? '#ff00aa' : '#00f0ff');

    // Player body (Neon cyber core / Golden rocket core)
    this.ctx.fillStyle = this.player.isOverdriveActive ? '#ffaa00' : (this.player.comboMultiplier > 4 ? '#ff007f' : '#00e5ff');
    const hw = this.player.width / 2;
    const hh = this.player.height / 2;
    this.ctx.beginPath();
    this.ctx.roundRect(-hw, -hh, this.player.width, this.player.height, this.player.isOverdriveActive ? 8 : 6);
    this.ctx.fill();

    // Inner bright neon core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.roundRect(-hw * 0.45, -hh * 0.45, this.player.width * 0.45, this.player.height * 0.45, 3);
    this.ctx.fill();

    // Directional aim eye / visor
    const eyeOffsetX = Math.cos(this.player.aimAngle) * 5;
    const eyeOffsetY = Math.sin(this.player.aimAngle) * 5;
    this.ctx.fillStyle = '#110520';
    this.ctx.fillRect(eyeOffsetX - 2, eyeOffsetY - 2, 4, 4);

    this.ctx.restore();
  }

  private drawTrajectory(): void {
    const points = this.physics.getTrajectoryPoints(
      this.player,
      this.player.aimAngle,
      this.player.charge,
      18
    );

    this.ctx.save();
    points.forEach((pt, idx) => {
      const alpha = 1 - (idx / points.length);
      const radius = Math.max(1.8, 5.5 * alpha);
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = idx % 2 === 0 ? '#ff00aa' : '#00f0ff';
      this.ctx.globalAlpha = alpha * 0.85;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Cap to 50ms to prevent physics explosion
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Boot game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
