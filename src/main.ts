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

  // Fluid Continuous Steering state
  private targetRotation = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartTime = 0;
  private isPointerDown = false;
  private keySteerDir = 0; // -1: Left, +1: Right, 0: Idle
  private cometParticleTimer = 0;
  private lastMilestoneTier = 0;

  // DOM Elements matching 1.png & 4-Way Cyber Controller
  private hudSpeed: HTMLElement;
  private tick1: HTMLElement;
  private tick2: HTMLElement;
  private tick3: HTMLElement;
  private tick4: HTMLElement;
  private hudScore: HTMLElement;
  private hudCombo: HTMLElement;
  private hudTimer: HTMLElement;
  private btnRestartTop: HTMLElement;
  private steeringMarker: HTMLElement;
  private steeringWidget: HTMLElement;
  private screenMsg: HTMLElement;

  // 4-Way D-Pad & Navigation Guidance Elements
  private btnUp: HTMLElement;
  private btnDown: HTMLElement;
  private btnLeft: HTMLElement;
  private btnRight: HTMLElement;
  private dpadCenter: HTMLElement;
  private dpadGuideText: HTMLElement;
  private dpadGuideSub: HTMLElement;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.physics = new PhysicsEngine();
    this.world = new WorldManager();
    this.particles = new ParticleManager();
    this.juice = new JuiceManager(this.physics.worldWidth, window.innerHeight);

    this.hudSpeed = document.getElementById('hud-speed')!;
    this.tick1 = document.getElementById('tick-1')!;
    this.tick2 = document.getElementById('tick-2')!;
    this.tick3 = document.getElementById('tick-3')!;
    this.tick4 = document.getElementById('tick-4')!;
    this.hudScore = document.getElementById('hud-score')!;
    this.hudCombo = document.getElementById('hud-combo')!;
    this.hudTimer = document.getElementById('hud-timer')!;
    this.btnRestartTop = document.getElementById('btn-restart-top')!;
    this.steeringMarker = document.getElementById('steering-marker')!;
    this.steeringWidget = document.getElementById('steering-widget')!;
    this.screenMsg = document.getElementById('screen-msg')!;

    this.btnUp = document.getElementById('btn-up')!;
    this.btnDown = document.getElementById('btn-down')!;
    this.btnLeft = document.getElementById('btn-left')!;
    this.btnRight = document.getElementById('btn-right')!;
    this.dpadCenter = document.getElementById('dpad-center')!;
    this.dpadGuideText = document.getElementById('dpad-guide-text')!;
    this.dpadGuideSub = document.getElementById('dpad-guide-sub')!;

    const savedBest = parseInt(localStorage.getItem('apex_best_depth') || '0', 10);

    this.player = {
      x: this.physics.worldWidth / 2,
      y: 90,
      vy: 200,
      radius: 14,
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
      roundTimeRemaining: 30.0,
      roundTimeTotal: 30.0,
      isFallingFast: false,
      speedMultiplier: 1.0,
      trailHistory: [],
      trailAngles: []
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

  // 4-Way PC Controls (WASD & Arrows), Touch Swipes, D-Pad Buttons & Fluid Drag
  private setupInputs(): void {
    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      if ('touches' in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      sound.init();
      if (this.state === 'START' || this.state === 'CRASHED') {
        this.startGame();
        return;
      }

      this.isPointerDown = true;
      const pos = getPos(e);
      this.pointerStartX = pos.x;
      this.pointerStartY = pos.y;
      this.pointerStartTime = Date.now();
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown || this.state !== 'PLAYING') return;
      const pos = getPos(e);
      const deltaX = pos.x - this.pointerStartX;
      this.pointerStartX = pos.x;

      // Continuous horizontal sliding around the circle
      this.targetRotation += (deltaX / 140) * Math.PI;
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      // Swipe / Flick Detection across 4 directions
      const clientX = 'changedTouches' in e && e.changedTouches.length > 0
        ? e.changedTouches[0].clientX
        : (e as MouseEvent).clientX;
      const clientY = 'changedTouches' in e && e.changedTouches.length > 0
        ? e.changedTouches[0].clientY
        : (e as MouseEvent).clientY;

      const dx = clientX - this.pointerStartX;
      const dy = clientY - this.pointerStartY;
      const elapsed = Date.now() - this.pointerStartTime;

      if (elapsed < 380 && this.state === 'PLAYING') {
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal Swipe: Sol / Sağ
            if (dx < 0) {
              this.targetRotation -= (Math.PI * 2) / 3;
              sound.playSnapClick();
            } else {
              this.targetRotation += (Math.PI * 2) / 3;
              sound.playSnapClick();
            }
          } else {
            // Vertical Swipe: Yukarı (Süzül) / Aşağı (Dalış)
            if (dy < 0) {
              this.executeAirGlide();
            } else {
              this.executeSlamDive();
            }
          }
        }
      }
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    this.steeringWidget.addEventListener('mousedown', handlePointerDown);
    this.steeringWidget.addEventListener('touchstart', handlePointerDown, { passive: true });

    // D-Pad Button Direct Controls (Touch & Click)
    this.btnUp.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.init();
      if (this.state === 'PLAYING') this.executeAirGlide();
    });

    this.btnDown.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.init();
      if (this.state === 'PLAYING') this.executeSlamDive();
    });

    this.btnLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.init();
      if (this.state === 'PLAYING') {
        this.targetRotation -= (Math.PI * 2) / 3;
        sound.playSnapClick();
      }
    });

    this.btnRight.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.init();
      if (this.state === 'PLAYING') {
        this.targetRotation += (Math.PI * 2) / 3;
        sound.playSnapClick();
      }
    });

    // Top restart icon
    this.btnRestartTop.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startGame();
    });

    // PC Keyboard: 4-Way Controls via WASD & Directional Arrow Keys
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
        // Sol: A veya Sol Ok
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.keySteerDir = -1;
          this.btnLeft.classList.add('active');
          this.targetRotation -= (Math.PI * 2) / 3 * 0.25;
        }
        // Sağ: D veya Sağ Ok
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.keySteerDir = 1;
          this.btnRight.classList.add('active');
          this.targetRotation += (Math.PI * 2) / 3 * 0.25;
        }
        // Yukarı: W veya Yukarı Ok (Süzül / Air-Brake)
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.btnUp.classList.add('active');
          this.executeAirGlide();
        }
        // Aşağı: S veya Aşağı Ok (Hızlı Dalış / Slam Dive)
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.btnDown.classList.add('active');
          this.executeSlamDive();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.keySteerDir === -1) {
        this.keySteerDir = 0;
        this.btnLeft.classList.remove('active');
      } else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.keySteerDir === 1) {
        this.keySteerDir = 0;
        this.btnRight.classList.remove('active');
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.btnUp.classList.remove('active');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.btnDown.classList.remove('active');
      }
    });
  }

  // 4-Way Action Triggers: Süzülme (W/Up) & Dalış (S/Down)
  private executeAirGlide(): void {
    this.physics.triggerAirGlide(this.player);
    this.particles.spawnShockwave(this.player.x, this.player.y, 50, '#00f0ff');
    this.particles.addFloatingText(this.player.x, this.player.y - 30, 'SÜZÜLME 🛡️', '#00f0ff', 18);
  }

  private executeSlamDive(): void {
    this.physics.triggerSlamDive(this.player);
    this.particles.spawnShockwave(this.player.x, this.player.y, 80, '#ffaa00');
    this.particles.addFloatingText(this.player.x, this.player.y - 30, 'HIZLI DALIŞ! ⚡', '#ffaa00', 22);
    this.juice.addShake(8, 0.16);
  }

  private showStartScreen(): void {
    this.screenMsg.innerHTML = `
      <div style="background: rgba(6, 3, 18, 0.94); border: 2px solid #00f0ff; border-radius: 24px; padding: 22px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.45); backdrop-filter: blur(8px);">
        <h1 style="font-family: 'Orbitron'; font-size: 26px; color: #00f0ff; text-shadow: 0 0 14px #00f0ff; margin-bottom: 4px;">APEX FALL</h1>
        <p style="color: #f59e0b; font-weight: 800; letter-spacing: 2px; font-size: 13px;">4 YÖNLÜ VORTEX KONTROLÜ</p>
        <div style="margin: 14px 0; font-size: 13.5px; color: #cbd5e1; line-height: 1.75; text-align: left; padding: 0 8px;">
          🎯 <b>Okları Takip Et:</b> Alttaki yanan okları izlersen engellere takılmazsın!<br>
          ◀▶ <b>A / D / Sol-Sağ:</b> Engellerin etrafından süzül<br>
          ▲ <b>W / Yukarı / Yukarı Kaydır:</b> Süzül / Yavaşla (Kalkan) 🛡️<br>
          ▼ <b>S / Aşağı / Aşağı Kaydır:</b> Hızlı Dalış (Engelleri Kır) ⚡<br>
          📈 <b>Dinamik Hız:</b> Her 10 adımda +0.1x hız artar (kontrollü & bağımlılık yapıcı)!
        </div>
        <button class="btn-action" id="btn-start">DALIŞA BAŞLA</button>
      </div>
    `;

    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.startGame();
    });
  }

  private showCrashScreen(): void {
    this.juice.addShake(22, 0.45);
    this.screenMsg.innerHTML = `
      <div style="background: rgba(26, 4, 14, 0.96); border: 2px solid #f59e0b; border-radius: 24px; padding: 24px; box-shadow: 0 0 35px rgba(245, 158, 11, 0.5); backdrop-filter: blur(8px);">
        <h2 style="font-family: 'Orbitron'; font-size: 24px; color: #f59e0b; text-shadow: 0 0 14px #f59e0b; margin-bottom: 4px;">ALTIN ENGELE ÇARPTIN!</h2>
        <p style="color: #00f0ff; font-weight: 800; font-size: 24px; margin: 8px 0;">${this.player.currentDepth}M DERİNLİK</p>
        <p style="color: #ffffff; font-weight: 700; font-size: 16px; margin-bottom: 4px;">SKOR: ${this.player.score.toLocaleString()}</p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 14px;">GEÇİLEN DELİK: ${this.player.perfectDropStreak}</p>
        <button class="btn-action" id="btn-restart" style="background: linear-gradient(135deg, #f59e0b, #00f0ff); font-weight: 900;">YENİDEN DALIŞ [R]</button>
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
      <div style="background: rgba(18, 5, 28, 0.96); border: 2px solid #ffe600; border-radius: 24px; padding: 24px; box-shadow: 0 0 35px rgba(255, 230, 0, 0.5); backdrop-filter: blur(8px);">
        <h2 style="font-family: 'Orbitron'; font-size: 24px; color: #ffe600; text-shadow: 0 0 14px #ffe600; margin-bottom: 4px;">⏱️ SÜRE DOLDU!</h2>
        <p style="color: #00f0ff; font-weight: 800; font-size: 24px; margin: 8px 0;">${this.player.currentDepth}M DERİNLİK</p>
        <p style="color: #ffffff; font-weight: 700; font-size: 16px; margin-bottom: 4px;">SKOR: ${this.player.score.toLocaleString()}</p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 14px;">GEÇİLEN DELİK: ${this.player.perfectDropStreak}</p>
        <button class="btn-action" id="btn-restart" style="background: linear-gradient(135deg, #ffe600, #a855f7); color: #000; font-weight: 900;">TEKRAR DALIŞ YAP [R]</button>
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
    this.keySteerDir = 0;
    this.lastMilestoneTier = 0;
    this.player.y = 90;
    this.player.vy = 200;
    this.player.roundTimeRemaining = 30.0;
    this.player.roundTimeTotal = 30.0;
    this.player.consecutiveGaps = 0;
    this.player.isMeteor = false;
    this.player.meteorTimer = 0;
    this.player.meteorSmashesRemaining = 0;
    this.player.isDiving = false;
    this.player.diveTimer = 0;
    this.player.isGliding = false;
    this.player.glideTimer = 0;
    this.player.speedMultiplier = 1.0;
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
    this.player.trailAngles = [];
  }

  private update(dt: number): void {
    // Continuous keyboard steering
    if (this.keySteerDir !== 0 && this.state === 'PLAYING') {
      this.targetRotation += this.keySteerDir * dt * 4.6;
    }

    // Smooth fluid magnetic interpolation for silky-smooth 120 FPS steering
    const rotDiff = this.targetRotation - this.player.cylinderRotation;
    this.player.cylinderRotation += rotDiff * Math.min(1, dt * 26);

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
        (ring) => {
          this.juice.addShake(4, 0.08);

          // Every 10 combo steps: celebrate +0.1 speed level up!
          const tier = Math.floor(this.player.perfectDropStreak / 10);
          if (tier > this.lastMilestoneTier) {
            this.lastMilestoneTier = tier;
            const speedVal = (1.0 + tier * 0.1).toFixed(1);
            this.particles.addFloatingText(this.player.x, ring.y - 45, `⚡ HIZ ARTTI! (x${speedVal}) ⚡`, '#ffe600', 26);
            this.juice.addShake(8, 0.2);
            sound.playMeteorIgnite();
          }
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

    // Update Bottom Steering Dial Marker based on current cylinder rotation
    const normRot = Math.sin(this.player.cylinderRotation);
    const markerX = normRot * 38;
    const markerY = Math.abs(normRot) * 12;
    this.steeringMarker.style.transform = `translate(${markerX}px, ${markerY}px)`;

    // Update Navigation Guidance Arrows (Following arrows ensures 100% obstacle avoidance)
    const upcomingRing = this.world.rings.find((r) => !r.isBroken && r.y > this.player.y);
    if (upcomingRing) {
      const guide = this.physics.getGuideDirection(this.player, upcomingRing);
      if (guide.step === -1) {
        // Safe gap is to the LEFT
        this.btnLeft.classList.add('guided');
        this.btnRight.classList.remove('guided');
        this.dpadCenter.classList.remove('safe');
        this.dpadGuideText.textContent = '◀ SOLA';
        this.dpadGuideText.style.color = '#00f0ff';
        this.dpadGuideSub.textContent = 'GÜVENLİ YOL';
      } else if (guide.step === 1) {
        // Safe gap is to the RIGHT
        this.btnRight.classList.add('guided');
        this.btnLeft.classList.remove('guided');
        this.dpadCenter.classList.remove('safe');
        this.dpadGuideText.textContent = 'SAĞA ▶';
        this.dpadGuideText.style.color = '#f59e0b';
        this.dpadGuideSub.textContent = 'GÜVENLİ YOL';
      } else {
        // ALIGNED WITH SAFE GAP!
        this.btnLeft.classList.remove('guided');
        this.btnRight.classList.remove('guided');
        this.dpadCenter.classList.add('safe');
        this.dpadGuideText.textContent = 'HİZALANDI ✓';
        this.dpadGuideText.style.color = '#39ff14';
        this.dpadGuideSub.textContent = 'TEMİZ DALIŞ';
      }
    }

    // Update Top HUD with Speed Multiplier Progression (Starts x1.0, +0.1x per 10 steps)
    const speedMul = this.player.speedMultiplier || 1.0;
    this.hudSpeed.textContent = `x${speedMul.toFixed(1)}`;
    const speedTier = Math.min(4, Math.max(1, Math.round((speedMul - 0.9) * 4)));
    this.tick1.className = `speed-tick ${speedTier >= 1 ? 'active' : ''}`;
    this.tick2.className = `speed-tick ${speedTier >= 2 ? 'active' : ''}`;
    this.tick3.className = `speed-tick ${speedTier >= 3 ? 'active' : ''}`;
    this.tick4.className = `speed-tick ${speedTier >= 4 ? 'active' : ''}`;

    this.hudScore.textContent = this.player.score.toLocaleString();
    const comboDisplay = Math.max(1, Math.round(this.player.comboMultiplier * 10));
    this.hudCombo.textContent = `x${comboDisplay}`;

    this.hudTimer.textContent = `⏱️ ${Math.max(0, this.player.roundTimeRemaining).toFixed(1)}s`;
    if (this.player.roundTimeRemaining <= 5.0) {
      this.hudTimer.classList.add('urgent');
    } else {
      this.hudTimer.classList.remove('urgent');
    }
  }

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw 3D Vortex Tunnel Background
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
    this.ctx.translate(this.juice.shakeOffsetX, this.juice.shakeOffsetY);

    // 2. Draw Concentric 3D Tunnel Rings & Golden Obstacles
    this.world.draw(
      this.ctx,
      this.juice.cameraY,
      height,
      this.player.cylinderRotation,
      this.player.colorThemeIndex,
      this.player.y,
      width
    );

    // 3. Draw Player Comet Tail, 3D Glass Marble Ball & 4-Way Action Animations
    this.drawPlayerBall(width, height);

    // 4. Draw Particles (Shards, sparks, shockwaves)
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }

  // Draw 3D Glass Blue Sphere Ball with Curving Comet Tail & 4-Way Action VFX
  private drawPlayerBall(width: number, height: number): void {
    const ctx = this.ctx;
    const cx = width / 2;
    const cy = height * 0.40;
    const R_COLLISION = 175;

    // Contact Angle + Cylinder Rotation determines current angular position on the ring
    const orbitAngle = Math.PI / 2 + this.player.cylinderRotation;
    const px = cx + Math.cos(orbitAngle) * R_COLLISION;
    const py = cy + Math.sin(orbitAngle) * R_COLLISION;
    this.player.x = px;

    const isMeteor = this.player.isMeteor;
    const isDiving = this.player.isDiving;
    const isGliding = this.player.isGliding;

    // A. Curving Continuous Comet Tail Ribbon along the circular track (matching 1.png)
    const tailSpan = isMeteor ? 1.05 : (isDiving ? 0.95 : 0.78);
    const tailSegments = 20;
    const baseRadius = this.player.radius;

    ctx.save();
    const tailTipX = cx + Math.cos(orbitAngle - tailSpan) * R_COLLISION;
    const tailTipY = cy + Math.sin(orbitAngle - tailSpan) * R_COLLISION;
    const tailGrad = ctx.createLinearGradient(px, py, tailTipX, tailTipY);

    if (isMeteor || isDiving) {
      tailGrad.addColorStop(0, '#ffffff');
      tailGrad.addColorStop(0.25, '#ffe600');
      tailGrad.addColorStop(0.65, '#ff4400');
      tailGrad.addColorStop(1, 'rgba(180, 0, 40, 0)');
    } else {
      tailGrad.addColorStop(0, '#ffffff');
      tailGrad.addColorStop(0.22, '#00f0ff');
      tailGrad.addColorStop(0.65, '#a855f7');
      tailGrad.addColorStop(1, 'rgba(88, 28, 135, 0)');
    }

    ctx.fillStyle = tailGrad;
    ctx.shadowColor = (isMeteor || isDiving) ? '#ff5500' : '#00f0ff';
    ctx.shadowBlur = (isMeteor || isDiving) ? 24 : 18;

    ctx.beginPath();
    for (let i = 0; i <= tailSegments; i++) {
      const frac = i / tailSegments;
      const angle = orbitAngle - frac * tailSpan;
      const w = baseRadius * (1 - frac) * ((isMeteor || isDiving) ? 1.3 : 0.95);
      const r = R_COLLISION + w;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = tailSegments; i >= 0; i--) {
      const frac = i / tailSegments;
      const angle = orbitAngle - frac * tailSpan;
      const w = baseRadius * (1 - frac) * ((isMeteor || isDiving) ? 1.3 : 0.95);
      const r = R_COLLISION - w;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sparkle stardust emitted off the comet tail
    this.cometParticleTimer += 0.03;
    if (this.cometParticleTimer > 0.07 && this.state === 'PLAYING') {
      this.cometParticleTimer = 0;
      const sparkAngle = orbitAngle - Math.random() * (tailSpan * 0.85);
      const sparkDist = R_COLLISION + (Math.random() - 0.5) * 14;
      const sx = cx + Math.cos(sparkAngle) * sparkDist;
      const sy = cy + Math.sin(sparkAngle) * sparkDist;
      this.particles.spawnSparks(sx, sy, (isMeteor || isDiving) ? '#ffaa00' : '#00f0ff', 1, 35);
    }

    // B. Special 4-Way Action Animation: AIR-BRAKE GLIDE SHIELD (YUKARI / W / UP)
    if (isGliding) {
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.lineWidth = 2.5;

      // Outer plasma shield bubble
      ctx.beginPath();
      ctx.arc(px, py, baseRadius * 1.85, 0, Math.PI * 2);
      ctx.stroke();

      // Hexagonal energy shield ripple
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h * Math.PI) / 3 + this.lastTime * 0.003;
        const hx = px + Math.cos(ha) * baseRadius * 1.5;
        const hy = py + Math.sin(ha) * baseRadius * 1.5;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // C. Special 4-Way Action Animation: SLAM DIVE SONIC CONE (AŞAĞI / S / DOWN)
    if (isDiving) {
      ctx.save();
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, baseRadius * 1.7, 0, Math.PI * 2);
      ctx.stroke();

      // Sonic boom shockwave ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, baseRadius * 2.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // D. Outer Neon Glow Bloom
    ctx.save();
    ctx.shadowColor = (isMeteor || isDiving) ? 'rgba(255, 68, 0, 0.95)' : 'rgba(0, 240, 255, 0.85)';
    ctx.shadowBlur = (isMeteor || isDiving) ? 28 : 20;

    // E. 3D Glass Sphere Body with Specular Highlight (matching 1.png blue marble)
    const ballGrad = ctx.createRadialGradient(
      px - baseRadius * 0.35,
      py - baseRadius * 0.35,
      baseRadius * 0.1,
      px,
      py,
      baseRadius * 1.05
    );

    if (isMeteor || isDiving) {
      ballGrad.addColorStop(0, '#ffffff'); // Specular core
      ballGrad.addColorStop(0.2, '#fef08a'); // Bright yellow
      ballGrad.addColorStop(0.55, '#f97316'); // Fire orange
      ballGrad.addColorStop(0.85, '#dc2626'); // Crimson
      ballGrad.addColorStop(1, '#7f1d1d'); // Deep dark ember rim
    } else {
      ballGrad.addColorStop(0, '#ffffff'); // Specular glint
      ballGrad.addColorStop(0.2, '#67e8f9'); // Electric cyan highlight
      ballGrad.addColorStop(0.55, '#0284c7'); // Sapphire blue body
      ballGrad.addColorStop(0.85, '#1e3a8a'); // Midnight cobalt blue
      ballGrad.addColorStop(1, '#0b1329'); // Dark glass rim
    }

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(px, py, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    // F. Crisp White Specular Crescent Highlight on Upper-Left Edge
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(
      px - baseRadius * 0.32,
      py - baseRadius * 0.35,
      baseRadius * 0.36,
      baseRadius * 0.2,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
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

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
