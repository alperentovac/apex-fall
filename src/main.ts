import { GameState, Ball, TurnResult } from './types';
import { WorldManager, PhysicsEngine } from './engine/zigzag';
import { sound } from './engine/audio';
import { ParticleManager } from './engine/particles';
import { JuiceManager } from './engine/juice';
import { GameRenderer } from './engine/render';

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public world: WorldManager;
  public physics: PhysicsEngine;
  public particles: ParticleManager;
  public juice: JuiceManager;
  public renderer: GameRenderer;

  public state: GameState = 'START';
  public ball: Ball;
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
    this.particles = new ParticleManager();
    this.juice = new JuiceManager();
    this.renderer = new GameRenderer();

    this.ball = this.createInitialBall();
    this.juice.reset(this.ball.x, this.ball.y);
    this.loadBestScores();
    this.setupResize();
    this.setupInput();
    this.setupUIButtons();
  }

  public createInitialBall(): Ball {
    return {
      x: 30,
      y: 0,
      z: 0,
      vx: this.physics.baseSpeed,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 11,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };
  }

  private loadBestScores(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        this.bestScore = parseInt(
          localStorage.getItem('apex_fall_best_score') || localStorage.getItem('zigzag_best_score') || '0',
          10
        );
        this.bestCombo = parseInt(
          localStorage.getItem('apex_fall_best_combo') || localStorage.getItem('zigzag_best_combo') || '0',
          10
        );
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
          localStorage.setItem('apex_fall_best_score', this.bestScore.toString());
          localStorage.setItem('zigzag_best_score', this.bestScore.toString());
        }
        if (this.combo > this.bestCombo) {
          this.bestCombo = this.combo;
          localStorage.setItem('apex_fall_best_combo', this.bestCombo.toString());
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
      if (this.state === 'PAUSED') return;
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
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          if (this.state === 'PLAYING') {
            this.pauseGame();
          } else if (this.state === 'PAUSED') {
            this.resumeGame();
          }
        }
      });
    }
  }

  private setupUIButtons(): void {
    if (typeof document === 'undefined') return;

    const btnHome = document.getElementById('btn-home');
    const btnMute = document.getElementById('btn-mute');
    const btnResume = document.getElementById('btn-resume');
    const btnReplay = document.getElementById('btn-replay');
    const modalMute = document.getElementById('modal-btn-mute');

    const updateMuteIcons = (muted: boolean) => {
      const svgOn = document.getElementById('svg-sound-on');
      const svgOff = document.getElementById('svg-sound-off');
      if (svgOn) svgOn.style.display = muted ? 'none' : 'block';
      if (svgOff) svgOff.style.display = muted ? 'block' : 'none';
      const muteText = document.getElementById('modal-mute-text');
      if (muteText) muteText.innerText = muted ? 'MÜZİK: KAPALI' : 'MÜZİK: AÇIK';
      if (btnMute) btnMute.title = muted ? 'Müziği Aç' : 'Müziği Kapat';
    };

    btnHome?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    });

    btnMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = sound.toggleMute();
      updateMuteIcons(muted);
    });

    modalMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = sound.toggleMute();
      updateMuteIcons(muted);
    });

    btnResume?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resumeGame();
    });

    btnReplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.restartGame();
      this.state = 'PLAYING';
      this.updatePauseModal(false);
      sound.playMusic();
    });
  }

  public pauseGame(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      sound.pauseMusic();
      this.updatePauseModal(true);
    }
  }

  public resumeGame(): void {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      sound.playMusic();
      this.updatePauseModal(false);
    }
  }

  private updatePauseModal(show: boolean): void {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('pause-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      const scoreSpan = document.getElementById('pause-score');
      const bestSpan = document.getElementById('pause-best');
      if (scoreSpan) scoreSpan.innerText = this.score.toString();
      if (bestSpan) bestSpan.innerText = this.bestScore.toString();
    }
  }

  public handleInput(): TurnResult | null {
    sound.init();
    sound.playMusic();

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
      sound.playMusic();
      return null;
    }

    if (this.state === 'PLAYING') {
      const prevPos = { x: this.ball.x, y: this.ball.y };
      const prevSeg = this.world.segments[this.ball.currentSegmentIndex];
      const corner = prevSeg ? { x: prevSeg.end.x, y: prevSeg.end.y } : { ...prevPos };

      const result = this.physics.evaluateTurn(this.ball, this.world);
      if (result === 'PERFECT' || result === 'GOOD') {
        this.juice.triggerTurnArc(prevPos, corner);
      }

      if (result === 'PERFECT') {
        this.combo++;
        // Exactly 1 score per turn
        this.score += 1;
        this.particles.spawnCornerSparks(this.ball, 14);
        sound.handleTurnEvent('PERFECT', this.combo);
        this.saveBestScores();
      } else if (result === 'GOOD') {
        this.combo = 0;
        // Exactly 1 score per turn
        this.score += 1;
        sound.handleTurnEvent('GOOD', 0);
        this.saveBestScores();
      } else {
        // Miss: fall triggered
        this.juice.triggerShake(4, 0.15);
        sound.handleTurnEvent('MISS', 0);
        this.saveBestScores();
      }
      return result;
    }

    return null;
  }

  public restartGame(): void {
    this.world.reset();
    this.ball = this.createInitialBall();
    this.juice.reset(this.ball.x, this.ball.y);
    this.particles.clear();
    this.score = 0;
    this.combo = 0;
    this.ballTrail = [];
    this.updatePauseModal(false);
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
      // Agresif Hızlanma: 110 px/s başlangıç, viraj başına +5.0 px/s, tavan 600 px/s (98. virajda maks)
      const currentSpeed = this.physics.calcSpeedForTurn(this.ball.currentSegmentIndex);
      if (this.ball.dir === 'X' && !this.ball.isFalling) {
        this.ball.vx = currentSpeed;
        this.ball.vy = 0;
      } else if (this.ball.dir === 'Y' && !this.ball.isFalling) {
        this.ball.vx = 0;
        this.ball.vy = currentSpeed;
      }

      this.physics.update(dt, this.ball, this.world);

      // Record visual trail using smooth visual position
      const visualBall = this.juice.getVisualBallPosition(this.ball);
      if (!this.ball.isFalling) {
        this.ballTrail.unshift({ x: visualBall.x, y: visualBall.y, z: visualBall.z, alpha: 1.0 });
        if (this.ballTrail.length > 25) {
          this.ballTrail.pop();
        }
      }

      // Check fall end (~300ms)
      if (this.ball.isFalling && this.ball.fallTimer >= 0.3) {
        this.state = 'GAME_OVER';
        this.saveBestScores();
      }

      // Smooth framerate-independent camera tracking
      this.juice.update(dt, this.ball);
    }

    // Update particle juice
    this.particles.update(dt);

    // Decay trail
    for (const t of this.ballTrail) {
      t.alpha = Math.max(0, t.alpha - dt * 2.8);
    }
  }

  public render(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const viewport = { width, height };

    const renderCamera = this.juice.getRenderCamera();
    const visualBallPos = this.juice.getVisualBallPosition(this.ball);
    const renderBall: Ball = {
      ...this.ball,
      x: visualBallPos.x,
      y: visualBallPos.y,
      z: visualBallPos.z
    };

    this.renderer.draw(
      this.ctx,
      viewport,
      renderCamera,
      this.world,
      renderBall,
      this.ballTrail,
      this.particles,
      this.state,
      this.score,
      this.combo,
      this.bestScore,
      this.bestCombo
    );
  }
}

// Auto-boot if running in browser
if (typeof window !== 'undefined' && document.getElementById('gameCanvas')) {
  const game = new Game();
  (window as unknown as { __game: Game }).__game = game;
  game.start();
}
