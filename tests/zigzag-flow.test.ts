import { describe, it, expect } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  WorldManager,
  PhysicsEngine,
  TurnResult,
  PathSegment,
  Ball
} from '../src/engine/zigzag';

describe('2.5D Isometric Coordinate Transformations', () => {
  const camera = { x: 100, y: 100, zoom: 1 };
  const viewport = { width: 800, height: 600 };

  it('correctly projects world (x, y, z) into 2.5D isometric screen coordinates', () => {
    // When ball is at camera center (100, 100, 0), it should be projected to screen center
    const centerScreen = worldToScreen({ x: 100, y: 100, z: 0 }, camera, viewport);
    expect(centerScreen.x).toBeCloseTo(400, 1);
    expect(centerScreen.y).toBeCloseTo(300, 1);

    // Height z decreases screen Y (rising up visually)
    const elevated = worldToScreen({ x: 100, y: 100, z: 50 }, camera, viewport);
    expect(elevated.x).toBeCloseTo(400, 1);
    expect(elevated.y).toBeCloseTo(250, 1); // 300 - 50 = 250
  });

  it('inverts screen coordinates back to world coordinates when z=0', () => {
    const worldPos = { x: 250, y: 180, z: 0 };
    const screenPos = worldToScreen(worldPos, camera, viewport);
    const invertedWorld = screenToWorld(screenPos, camera, viewport);

    expect(invertedWorld.x).toBeCloseTo(worldPos.x, 2);
    expect(invertedWorld.y).toBeCloseTo(worldPos.y, 2);
  });
});

describe('Path Generation Seam', () => {
  it('generates forward-only zigzag segments alternating strictly between +X and +Y', () => {
    const world = new WorldManager();
    expect(world.segments.length).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < world.segments.length - 1; i++) {
      const curr = world.segments[i];
      const next = world.segments[i + 1];

      // End of current must connect to start of next
      expect(curr.end.x).toBeCloseTo(next.start.x, 4);
      expect(curr.end.y).toBeCloseTo(next.start.y, 4);

      // Must strictly alternate direction between X and Y
      expect(curr.dir).not.toBe(next.dir);

      // Forward progression: x and y must never decrease
      expect(next.end.x).toBeGreaterThanOrEqual(next.start.x);
      expect(next.end.y).toBeGreaterThanOrEqual(next.start.y);
    }
  });

  it('dynamically computes minimum segment lengths based on current velocity to preserve human reaction time', () => {
    const world = new WorldManager();
    const slowSpeed = 150; // pixels per sec
    const fastSpeed = 400; // pixels per sec

    const minSlowLength = world.calcMinSegmentLength(slowSpeed);
    const minFastLength = world.calcMinSegmentLength(fastSpeed);

    // Faster speed requires longer segment length for reaction time
    expect(minFastLength).toBeGreaterThan(minSlowLength);

    // With min reaction time >= 0.25s, min length at fastSpeed must be >= 100
    expect(minFastLength).toBeGreaterThanOrEqual(fastSpeed * 0.25);
  });

  it('generates non-overlapping paths with progressive segments ahead of the player', () => {
    const world = new WorldManager();
    const initialCount = world.segments.length;

    // Advance ahead
    world.ensureSegmentsAhead(20, 250);
    expect(world.segments.length).toBeGreaterThanOrEqual(20);

    // Coordinates strictly increase
    const first = world.segments[0];
    const last = world.segments[world.segments.length - 1];
    expect(last.end.x + last.end.y).toBeGreaterThan(first.start.x + first.start.y);
  });
});

describe('Vector Timing & Corner Seam', () => {
  function createTestSetup() {
    const world = new WorldManager();
    // Segment 0: (0,0) -> (100, 0), dir: 'X'
    // Segment 1: (100,0) -> (100, 100), dir: 'Y'
    world.segments = [
      {
        index: 0,
        dir: 'X',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        length: 100,
        tileWidth: 40
      },
      {
        index: 1,
        dir: 'Y',
        start: { x: 100, y: 0 },
        end: { x: 100, y: 100 },
        length: 100,
        tileWidth: 40
      }
    ];

    const physics = new PhysicsEngine();
    return { world, physics };
  }

  it('evaluates Perfect when tap is within tight apex tolerance (d <= R_perfect) and never snaps ball position', () => {
    const { world, physics } = createTestSetup();

    // Ball approaching corner at (100, 0), currently at (97, 0). Distance to corner is 3 <= R_perfect (12)
    const ball: Ball = {
      x: 97,
      y: 0,
      z: 0,
      vx: 150,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 10,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };

    const initialX = ball.x;
    const initialY = ball.y;

    const result = physics.evaluateTurn(ball, world);
    expect(result).toBe('PERFECT');

    // Direction flipped to Y
    expect(ball.dir).toBe('Y');
    expect(ball.vx).toBe(0);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.currentSegmentIndex).toBe(1);

    // Position MUST NOT be artificially snapped!
    expect(ball.x).toBe(initialX);
    expect(ball.y).toBe(initialY);
  });

  it('evaluates Good when tap is on platform tile but outside Perfect radius (R_perfect < d <= R_good)', () => {
    const { world, physics } = createTestSetup();

    // Ball approaching corner at (100, 0), currently at (82, 0). Distance is 18 (R_perfect = 12, R_good = 24)
    const ball: Ball = {
      x: 82,
      y: 0,
      z: 0,
      vx: 150,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 10,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };

    const initialX = ball.x;
    const initialY = ball.y;

    const result = physics.evaluateTurn(ball, world);
    expect(result).toBe('GOOD');

    expect(ball.dir).toBe('Y');
    expect(ball.vx).toBe(0);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.currentSegmentIndex).toBe(1);

    // Position preserved
    expect(ball.x).toBe(initialX);
    expect(ball.y).toBe(initialY);
  });

  it('evaluates Miss when tap occurs too early (d > R_good) and leads to falling', () => {
    const { world, physics } = createTestSetup();

    // Ball at (50, 0), distance to corner (100, 0) is 50 > R_good (24)
    const ball: Ball = {
      x: 50,
      y: 0,
      z: 0,
      vx: 150,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 10,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };

    const result = physics.evaluateTurn(ball, world);
    expect(result).toBe('MISS');

    // Miss turns into void: ball starts falling
    expect(ball.isFalling).toBe(true);
  });

  it('causes ball to roll off platform and fall when player fails to turn before overshooting corner', () => {
    const { world, physics } = createTestSetup();

    // Ball was at (95, 0), moved forward with dt=0.2s at vx=150, ending at (125, 0).
    // Tile extends to 100 + tileWidth/2 = 120. Ball at 125 has overshot the tile!
    const ball: Ball = {
      x: 95,
      y: 0,
      z: 0,
      vx: 150,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 10,
      currentSegmentIndex: 0,
      isFalling: false,
      fallTimer: 0
    };

    physics.update(0.2, ball, world);

    // Ball has overshot platform and is falling
    expect(ball.isFalling).toBe(true);
    expect(ball.z).toBeLessThan(0);
  });

  it('accelerates downward under gravity when falling and tracks fallTimer', () => {
    const { world, physics } = createTestSetup();

    const ball: Ball = {
      x: 130,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      dir: 'X',
      radius: 10,
      currentSegmentIndex: 0,
      isFalling: true,
      fallTimer: 0
    };

    physics.update(0.1, ball, world);
    expect(ball.vz).toBeLessThan(0);
    expect(ball.z).toBeLessThan(0);
    expect(ball.fallTimer).toBeCloseTo(0.1, 2);
  });
});

describe('Single-Tap Controls & Instant Restart Seam', () => {
  it('transitions from START to PLAYING on first tap, evaluates turns during play, and restarts instantly from GAME_OVER', async () => {
    // Import Game
    const { Game } = await import('../src/main');
    const mockCanvas = {
      getContext: () => ({
        resetTransform: () => {},
        scale: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        createRadialGradient: () => ({
          addColorStop: () => {}
        })
      }),
      addEventListener: () => {},
      parentElement: null,
      width: 400,
      height: 600
    } as unknown as HTMLCanvasElement;

    const game = new Game(mockCanvas);
    expect(game.state).toBe('START');

    // First tap launches game
    game.handleInput();
    expect(game.state).toBe('PLAYING');
    expect(game.ball.vx).toBeGreaterThan(0);

    // Simulate ball fall
    game.ball.isFalling = true;
    game.ball.fallTimer = 0.35;
    game.update(0.01);
    expect(game.state).toBe('GAME_OVER');

    // Tap on GAME_OVER immediately restarts to PLAYING with zero delay
    game.handleInput();
    expect(game.state).toBe('PLAYING');
    expect(game.score).toBe(0);
    expect(game.combo).toBe(0);
    expect(game.ball.isFalling).toBe(false);
    expect(game.ball.currentSegmentIndex).toBe(0);
  });
});

describe('Combo & Audio Tier Seam', () => {
  it('correctly calculates audio tiers based on combo streaks', async () => {
    const { SoundManager } = await import('../src/engine/audio');
    const audio = new SoundManager();

    expect(audio.getTierForCombo(0)).toBe(0);
    expect(audio.getTierForCombo(1)).toBe(1);
    expect(audio.getTierForCombo(9)).toBe(1);
    expect(audio.getTierForCombo(10)).toBe(2);
    expect(audio.getTierForCombo(24)).toBe(2);
    expect(audio.getTierForCombo(25)).toBe(3);
    expect(audio.getTierForCombo(49)).toBe(3);
    expect(audio.getTierForCombo(50)).toBe(4);
    expect(audio.getTierForCombo(99)).toBe(4);
    expect(audio.getTierForCombo(100)).toBe(5);
    expect(audio.getTierForCombo(250)).toBe(5);
  });

  it('smoothly steps down active audio tier by one level on Good turn instead of abrupt cutoff', async () => {
    const { SoundManager } = await import('../src/engine/audio');
    const audio = new SoundManager();

    // Player reaches combo 30 (Tier 3)
    audio.handleTurnEvent('PERFECT', 30);
    expect(audio.getActiveTier()).toBe(3);

    // Player makes a Good turn: combo resets to 0, tier drops by exactly 1 level (3 -> 2)
    audio.handleTurnEvent('GOOD', 0);
    expect(audio.getActiveTier()).toBe(2);

    // Another Good turn: drops from 2 -> 1
    audio.handleTurnEvent('GOOD', 0);
    expect(audio.getActiveTier()).toBe(1);

    // Another Good turn: drops from 1 -> 0
    audio.handleTurnEvent('GOOD', 0);
    expect(audio.getActiveTier()).toBe(0);

    // Another Good turn: clamped at 0
    audio.handleTurnEvent('GOOD', 0);
    expect(audio.getActiveTier()).toBe(0);
  });

  it('plays pentatonic note on Perfect turn and triggers milestone flourish at tier boundaries', async () => {
    const { SoundManager } = await import('../src/engine/audio');
    const audio = new SoundManager();

    let milestoneTriggered = false;
    audio.onMilestone = () => {
      milestoneTriggered = true;
    };

    // Non-milestone perfect
    audio.handleTurnEvent('PERFECT', 5);
    expect(milestoneTriggered).toBe(false);

    // Milestone perfect at 10
    audio.handleTurnEvent('PERFECT', 10);
    expect(milestoneTriggered).toBe(true);
  });
});

describe('High Score & Persistence Seam', () => {
  it('reads and persists best score and highest combo to localStorage', async () => {
    // Mock localStorage
    const storage: Record<string, string> = {
      zigzag_best_score: '120',
      zigzag_best_combo: '15'
    };

    const mockLocalStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      }
    };

    // Temporarily attach to globalThis
    const origStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });

    try {
      const { Game } = await import('../src/main');
      const mockCanvas = {
        getContext: () => ({
          resetTransform: () => {},
          scale: () => {},
          fillRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          stroke: () => {},
          arc: () => {},
          save: () => {},
          restore: () => {},
          fillText: () => {},
          createRadialGradient: () => ({
            addColorStop: () => {}
          })
        }),
        addEventListener: () => {},
        parentElement: null,
        width: 400,
        height: 600
      } as unknown as HTMLCanvasElement;

      const game = new Game(mockCanvas);
      expect(game.bestScore).toBe(120);
      expect(game.bestCombo).toBe(15);

      // Score higher
      game.score = 250;
      game.combo = 28;
      game.saveBestScores();

      expect(storage['zigzag_best_score']).toBe('250');
      expect(storage['zigzag_best_combo']).toBe('28');
      expect(game.bestScore).toBe(250);
      expect(game.bestCombo).toBe(28);

      // Lower score should not overwrite best
      game.score = 80;
      game.saveBestScores();
      expect(storage['zigzag_best_score']).toBe('250');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: origStorage,
        writable: true,
        configurable: true
      });
    }
  });

  it('progressively scales speed smoothly with each turn and strictly stabilizes at maxSpeed cap', () => {
    const physics = new PhysicsEngine();

    expect(physics.calcSpeedForTurn(0)).toBe(110);
    expect(physics.calcSpeedForTurn(50)).toBe(150); // 110 + 50 * 0.8
    expect(physics.calcSpeedForTurn(100)).toBe(190); // 110 + 100 * 0.8
    expect(physics.calcSpeedForTurn(200)).toBe(270); // 110 + 200 * 0.8

    // Reaching and stabilizing at 400 px/s max cap
    expect(physics.calcSpeedForTurn(400)).toBe(400);
    expect(physics.calcSpeedForTurn(600)).toBe(400);

    // Dynamic tolerances scale with speed
    const baseTol = physics.getTolerances(110);
    expect(baseTol.rPerfect).toBe(16);
    expect(baseTol.rGood).toBe(42);

    const maxTol = physics.getTolerances(400);
    expect(maxTol.rPerfect).toBe(24);
    expect(maxTol.rGood).toBe(60);
  });
});

describe('Procedural Variety, Rapid Bursts & Gems Seam', () => {
  it('procedurally generates rapid bursts of 5-6 quick turns interspersed across the path', () => {
    const world = new WorldManager();
    world.ensureSegmentsAhead(80, 150);

    // Look for RAPID_BURST segments
    const burstSegments = world.segments.filter((s) => s.patternType === 'RAPID_BURST');
    expect(burstSegments.length).toBeGreaterThanOrEqual(5);

    // Verify bursts occur in consecutive clusters of at least 5 turns
    let maxConsecutiveBurst = 0;
    let currBurst = 0;
    for (const seg of world.segments) {
      if (seg.patternType === 'RAPID_BURST') {
        currBurst++;
        maxConsecutiveBurst = Math.max(maxConsecutiveBurst, currBurst);
      } else {
        currBurst = 0;
      }
    }
    expect(maxConsecutiveBurst).toBeGreaterThanOrEqual(5);

    // Forward progression and alternating direction strictly preserved across entire path
    for (let i = 0; i < world.segments.length - 1; i++) {
      expect(world.segments[i].dir).not.toBe(world.segments[i + 1].dir);
      expect(world.segments[i + 1].end.x).toBeGreaterThanOrEqual(world.segments[i].start.x);
      expect(world.segments[i + 1].end.y).toBeGreaterThanOrEqual(world.segments[i].start.y);
    }
  });

  it('provides extra timing tolerance during rapid burst segments so rapid tapping remains fair and forgiving', () => {
    const physics = new PhysicsEngine();
    const standardTol = physics.getTolerances(150, false);
    const burstTol = physics.getTolerances(150, true);

    expect(burstTol.rGood).toBeGreaterThan(standardTol.rGood);
    expect(burstTol.rPerfect).toBeGreaterThan(standardTol.rPerfect);
  });

  it('spawns collectible path gems and marks them collected when ball passes them', () => {
    const world = new WorldManager();
    world.ensureSegmentsAhead(60, 150);

    const gemSegments = world.segments.filter((s) => s.hasGem);
    expect(gemSegments.length).toBeGreaterThan(0);

    const gemSeg = gemSegments[0];
    expect(gemSeg.gemCollected).toBe(false);
  });
});

describe('Pause, Single-Point Scoring & Audio Controls Seam', () => {
  it('increments score by exactly 1 per successful turn', async () => {
    const { Game } = await import('../src/main');
    const mockCanvas = {
      getContext: () => ({
        resetTransform: () => {},
        scale: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        createRadialGradient: () => ({
          addColorStop: () => {}
        })
      }),
      addEventListener: () => {},
      parentElement: null,
      width: 400,
      height: 600
    } as unknown as HTMLCanvasElement;

    const game = new Game(mockCanvas);
    game.state = 'PLAYING';
    game.score = 0;

    // Simulate perfect turn
    game.ball.x = 260; // right on corner
    game.handleInput();
    expect(game.score).toBe(1);

    // Simulate next turn
    game.ball.y = game.world.segments[1].end.y;
    game.handleInput();
    expect(game.score).toBe(2);
  });

  it('pauses and resumes the game without advancing physics while paused', async () => {
    const { Game } = await import('../src/main');
    const mockCanvas = {
      getContext: () => ({
        resetTransform: () => {},
        scale: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        createRadialGradient: () => ({
          addColorStop: () => {}
        })
      }),
      addEventListener: () => {},
      parentElement: null,
      width: 400,
      height: 600
    } as unknown as HTMLCanvasElement;

    const game = new Game(mockCanvas);
    game.state = 'PLAYING';

    const startX = game.ball.x;
    game.pauseGame();
    expect(game.state).toBe('PAUSED');

    // While paused, update must freeze ball movement
    game.update(0.1);
    expect(game.ball.x).toBe(startX);

    game.resumeGame();
    expect(game.state).toBe('PLAYING');

    game.update(0.1);
    expect(game.ball.x).toBeGreaterThan(startX);
  });

  it('supports background music toggling via sound manager', async () => {
    const { SoundManager } = await import('../src/engine/audio');
    const audio = new SoundManager();

    expect(audio.isMuted).toBe(false);
    audio.toggleMute();
    expect(audio.isMuted).toBe(true);
    audio.toggleMute();
    expect(audio.isMuted).toBe(false);
  });
});






