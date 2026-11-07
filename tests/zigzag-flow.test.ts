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

