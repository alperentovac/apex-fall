import { GameState, Ball, TurnResult } from './types';
import { WorldManager, PhysicsEngine, worldToScreen } from './engine/zigzag';

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public world: WorldManager;
  public physics: PhysicsEngine;

  public state: GameState = 'START';
  public ball: Ball;
  public camera = { x: 0, y: 0, zoom: 1 };
  public score = 0;
  public combo = 0;
  public bestScore = 0;
  public bestCombo = 0;

  private lastTime = 0;
  private animationFrameId: number | null = null;
  private ballTrail: Array<{ x: number; y: number; z: number; alpha: number }> = [];

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas || (document.getElementById('gameCanvas') as HTMLCanvasElement);
    this.ctx = this.canvas.getContext('2d')!;

    this.world = new WorldManager();
    this.physics = new PhysicsEngine();

    this.ball = this.createInitialBall();
    this.loadBestScores();
    this.setupResize();
    this.setupInput();
  }

  public createInitialBall(): Ball {
    return {
      x: 20,
      y: 0,
      z: 0,
      vx: this.physics.baseSpeed,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 9,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };
  }

  private loadBestScores(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        this.bestScore = parseInt(localStorage.getItem('zigzag_best_score') || '0', 10);
        this.bestCombo = parseInt(localStorage.getItem('zigzag_best_combo') || '0', 10);
      }
    } catch {
      this.bestScore = 0;
      this.bestCombo = 0;
    }
  }

  public saveBestScores(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          localStorage.setItem('zigzag_best_score', this.bestScore.toString());
        }
        if (this.combo > this.bestCombo) {
          this.bestCombo = this.combo;
          localStorage.setItem('zigzag_best_combo', this.bestCombo.toString());
        }
      }
    } catch {
      // Ignore localStorage failures
    }
  }

  private setupResize(): void {
    if (typeof window === 'undefined') return;

    const resize = () => {
      const container = this.canvas.parentElement;
      const width = container ? container.clientWidth : window.innerWidth;
      const height = container ? container.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();
  }

  private setupInput(): void {
    const handleAction = () => {
      this.handleInput();
    };

    this.canvas.addEventListener?.('pointerdown', (e) => {
      e.preventDefault();
      handleAction();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          handleAction();
        }
      });
    }
  }

  public handleInput(): TurnResult | null {
    if (this.state === 'START') {
      this.state = 'PLAYING';
      this.ball.vx = this.physics.baseSpeed;
      this.ball.vy = 0;
      return null;
    }

    if (this.state === 'GAME_OVER') {
      // Instant zero-delay restart
      this.restartGame();
      this.state = 'PLAYING';
      return null;
    }

    if (this.state === 'PLAYING') {
      const result = this.physics.evaluateTurn(this.ball, this.world);
      if (result === 'PERFECT') {
        this.combo++;
        this.score += 10 + this.combo * 2;
        this.saveBestScores();
      } else if (result === 'GOOD') {
        this.combo = 0;
        this.score += 5;
        this.saveBestScores();
      } else {
        // Miss
        this.saveBestScores();
      }
      return result;
    }

    return null;
  }

  public restartGame(): void {
    this.world.reset();
    this.ball = this.createInitialBall();
    this.camera.x = this.ball.x;
    this.camera.y = this.ball.y;
    this.score = 0;
    this.combo = 0;
    this.ballTrail = [];
  }

  public start(): void {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public update(dt: number): void {
    if (this.state === 'PLAYING') {
      // Progressive speed scaling
      const currentSpeed = this.physics.baseSpeed + Math.min(this.score * 0.4, 200);
      if (this.ball.dir === 'X' && !this.ball.isFalling) {
        this.ball.vx = currentSpeed;
        this.ball.vy = 0;
      } else if (this.ball.dir === 'Y' && !this.ball.isFalling) {
        this.ball.vx = 0;
        this.ball.vy = currentSpeed;
      }

      this.physics.update(dt, this.ball, this.world);

      // Record trail
      if (!this.ball.isFalling) {
        this.ballTrail.unshift({ x: this.ball.x, y: this.ball.y, z: this.ball.z, alpha: 1.0 });
        if (this.ballTrail.length > 25) {
          this.ballTrail.pop();
        }
      }

      // Check fall end (~300ms)
      if (this.ball.isFalling && this.ball.fallTimer >= 0.3) {
        this.state = 'GAME_OVER';
        this.saveBestScores();
      }

      // Smooth camera follow
      this.camera.x += (this.ball.x - this.camera.x) * 0.12;
      this.camera.y += (this.ball.y - this.camera.y) * 0.12;
    }

    // Decay trail
    for (const t of this.ballTrail) {
      t.alpha = Math.max(0, t.alpha - dt * 2.5);
    }
  }

  public render(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const viewport = { width, height };

    // Midnight void background
    this.ctx.fillStyle = '#090D18';
    this.ctx.fillRect(0, 0, width, height);

    // Render path segments
    this.renderPath(viewport);

    // Render trail
    this.renderTrail(viewport);

    // Render glowing ball
    this.renderBall(viewport);

    // Render HUD
    this.renderHUD(width, height);
  }

  private renderPath(viewport: { width: number; height: number }): void {
    const startIdx = Math.max(0, this.ball.currentSegmentIndex - 2);
    const endIdx = Math.min(this.world.segments.length, this.ball.currentSegmentIndex + 14);

    for (let i = startIdx; i < endIdx; i++) {
      const seg = this.world.segments[i];
      const halfW = seg.tileWidth / 2;

      // Draw segment as an isometric ribbon / platform
      let p0: { x: number; y: number };
      let p1: { x: number; y: number };
      let p2: { x: number; y: number };
      let p3: { x: number; y: number };

      if (seg.dir === 'X') {
        p0 = worldToScreen({ x: seg.start.x, y: seg.start.y - halfW, z: 0 }, this.camera, viewport);
        p1 = worldToScreen({ x: seg.end.x, y: seg.end.y - halfW, z: 0 }, this.camera, viewport);
        p2 = worldToScreen({ x: seg.end.x, y: seg.end.y + halfW, z: 0 }, this.camera, viewport);
        p3 = worldToScreen({ x: seg.start.x, y: seg.start.y + halfW, z: 0 }, this.camera, viewport);
      } else {
        p0 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y, z: 0 }, this.camera, viewport);
        p1 = worldToScreen({ x: seg.end.x - halfW, y: seg.end.y, z: 0 }, this.camera, viewport);
        p2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y, z: 0 }, this.camera, viewport);
        p3 = worldToScreen({ x: seg.start.x + halfW, y: seg.start.y, z: 0 }, this.camera, viewport);
      }

      // Top surface
      this.ctx.beginPath();
      this.ctx.moveTo(p0.x, p0.y);
      this.ctx.lineTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.lineTo(p3.x, p3.y);
      this.ctx.closePath();

      this.ctx.fillStyle = i === this.ball.currentSegmentIndex ? '#1d2a4a' : '#141d33';
      this.ctx.fill();
      this.ctx.strokeStyle = '#00f0ff33';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Corner platform indicator
      const cornerScreen = worldToScreen({ x: seg.end.x, y: seg.end.y, z: 0 }, this.camera, viewport);
      this.ctx.beginPath();
      this.ctx.arc(cornerScreen.x, cornerScreen.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#00f0ff88';
      this.ctx.fill();
    }
  }

  private renderTrail(viewport: { width: number; height: number }): void {
    for (const t of this.ballTrail) {
      if (t.alpha <= 0.05) continue;
      const screenPos = worldToScreen({ x: t.x, y: t.y, z: t.z }, this.camera, viewport);
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, this.ball.radius * 0.75, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.35})`;
      this.ctx.fill();
    }
  }

  private renderBall(viewport: { width: number; height: number }): void {
    const screenPos = worldToScreen(this.ball, this.camera, viewport);

    // Ball glow
    const grad = this.ctx.createRadialGradient(
      screenPos.x,
      screenPos.y,
      2,
      screenPos.x,
      screenPos.y,
      this.ball.radius * 2.5
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#00f0ff');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, this.ball.radius * 2.5, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Solid ball core
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
  }

  private renderHUD(width: number, height: number): void {
    this.ctx.save();
    this.ctx.font = '700 16px "Orbitron", sans-serif';

    // Top-left: Score
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SCORE ${this.score}`, 24, 38);

    // Top-center: Perfect Combo
    if (this.combo > 0) {
      this.ctx.fillStyle = '#ffe600';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`×${this.combo}`, width / 2, 38);
    }

    // Top-right: Best Score
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`BEST ${this.bestScore}`, width - 24, 38);

    // State overlays
    if (this.state === 'START') {
      this.ctx.fillStyle = 'rgba(9, 13, 24, 0.75)';
      this.ctx.fillRect(0, 0, width, height);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '900 28px "Orbitron", sans-serif';
      this.ctx.fillText('ZIGZAG FLOW', width / 2, height / 2 - 30);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '700 14px "Rajdhani", sans-serif';
      this.ctx.fillText('TAP OR PRESS SPACE TO START', width / 2, height / 2 + 15);
    } else if (this.state === 'GAME_OVER') {
      this.ctx.fillStyle = 'rgba(9, 13, 24, 0.8)';
      this.ctx.fillRect(0, 0, width, height);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = '900 26px "Orbitron", sans-serif';
      this.ctx.fillText('FALL DETECTED', width / 2, height / 2 - 40);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '700 18px "Orbitron", sans-serif';
      this.ctx.fillText(`SCORE: ${this.score}  |  BEST: ${this.bestScore}`, width / 2, height / 2);

      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '700 13px "Rajdhani", sans-serif';
      this.ctx.fillText('TAP TO RESTART INSTANTLY', width / 2, height / 2 + 45);
    }

    this.ctx.restore();
  }
}

// Auto-boot if running in browser
if (typeof window !== 'undefined' && document.getElementById('gameCanvas')) {
  const game = new Game();
  game.start();
}
