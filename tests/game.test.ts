import { describe, it, expect } from 'vitest';
import { WorldManager } from '../src/engine/world';
import { PhysicsEngine } from '../src/engine/physics';
import { ParticleManager } from '../src/engine/particles';
import { Player, Ring } from '../src/types';

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    x: 240,
    y: 100,
    vy: 300,
    radius: 14,
    consecutiveGaps: 0,
    isMeteor: false,
    meteorTimer: 0,
    meteorMaxTimer: 4.0,
    meteorSmashesRemaining: 0,
    isPlunging: false,
    plungeBoost: 0,
    cylinderRotation: 0,
    rotationVelocity: 0,
    tiltAngle: 0,
    scaleX: 1,
    scaleY: 1,
    colorThemeIndex: 0,
    currentDepth: 0,
    maxDepthAchieved: 0,
    score: 0,
    totalGems: 0,
    comboMultiplier: 1.0,
    perfectDropStreak: 0,
    isFallingFast: false,
    trailHistory: [],
    ...overrides
  };
}

describe('Vortex Dive - Ring Generation & Angular Seam', () => {
  it('generates rings with non-overlapping segments covering the complete circle', () => {
    const world = new WorldManager();
    expect(world.rings.length).toBeGreaterThan(20);

    for (const ring of world.rings) {
      expect(ring.segments.length).toBeGreaterThan(0);
      expect(ring.segments[0].startAngle).toBeCloseTo(0, 4);
      expect(ring.segments[ring.segments.length - 1].endAngle).toBeCloseTo(Math.PI * 2, 4);

      for (let i = 0; i < ring.segments.length - 1; i++) {
        expect(ring.segments[i].endAngle).toBeCloseTo(ring.segments[i + 1].startAngle, 4);
      }
    }
  });

  it('progresses difficulty: early rings have wide gaps & no hazards, deeper rings include hazards', () => {
    const world = new WorldManager();
    const ring0 = world.rings.find((r) => r.depth === 0)!;
    expect(ring0).toBeDefined();

    const ring0Hazards = ring0.segments.filter((s) => s.type === 'HAZARD');
    const ring0Gaps = ring0.segments.filter((s) => s.type === 'GAP');
    expect(ring0Hazards.length).toBe(0);
    expect(ring0Gaps.length).toBeGreaterThan(0);

    const ring12 = world.rings.find((r) => r.depth === 12);
    expect(ring12).toBeDefined();
    const ring12Hazards = ring12!.segments.filter((s) => s.type === 'HAZARD');
    expect(ring12Hazards.length).toBeGreaterThan(0);
  });

  it('correctly maps arbitrary angles to appropriate ring segments taking rotation into account', () => {
    const world = new WorldManager();
    const mockRing: Ring = {
      id: 99,
      depth: 1,
      y: 200,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI * 0.5, type: 'SAFE' },
        { startAngle: Math.PI * 0.5, endAngle: Math.PI, type: 'GAP' },
        { startAngle: Math.PI, endAngle: Math.PI * 1.5, type: 'HAZARD' },
        { startAngle: Math.PI * 1.5, endAngle: Math.PI * 2, type: 'SAFE' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    };

    const segSafe = world.getSegmentAtAngle(mockRing, Math.PI * 0.25);
    expect(segSafe?.type).toBe('SAFE');

    const segGap = world.getSegmentAtAngle(mockRing, Math.PI * 0.75);
    expect(segGap?.type).toBe('GAP');

    const segHazard = world.getSegmentAtAngle(mockRing, Math.PI * 1.25);
    expect(segHazard?.type).toBe('HAZARD');

    mockRing.rotation = Math.PI * 0.5;
    const segRotated = world.getSegmentAtAngle(mockRing, Math.PI * 0.75);
    expect(segRotated?.type).toBe('SAFE');
  });
});

describe('Vortex Dive - Angular Collision & Freefall Seam', () => {
  it('allows clean freefall passage through GAP segment and shifts color theme', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const testRing: Ring = {
      id: 1,
      depth: 1,
      y: 200,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI * 0.2, type: 'SAFE' },
        { startAngle: Math.PI * 0.2, endAngle: Math.PI * 0.8, type: 'GAP' },
        { startAngle: Math.PI * 0.8, endAngle: Math.PI * 2, type: 'SAFE' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    };

    const player = createMockPlayer({
      y: 195,
      vy: 400,
      cylinderRotation: 0,
      colorThemeIndex: 0
    });

    let passedGap = false;
    let crashed = false;

    physics.update(
      0.02,
      player,
      [testRing],
      [],
      particles,
      () => {
        crashed = true;
      },
      () => {
        passedGap = true;
      }
    );

    expect(crashed).toBe(false);
    expect(passedGap).toBe(true);
    expect(testRing.passed).toBe(true);
    expect(player.consecutiveGaps).toBe(1);
    expect(player.currentDepth).toBe(1);
    expect(player.colorThemeIndex).toBe(1); // Color theme shifted!
    expect(player.vy).toBeGreaterThan(400);
  });

  it('triggers safe bounce on SAFE landing pad, resetting consecutive gaps', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const testRing: Ring = {
      id: 2,
      depth: 2,
      y: 300,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI, type: 'SAFE' },
        { startAngle: Math.PI, endAngle: Math.PI * 2, type: 'GAP' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    };

    const player = createMockPlayer({
      y: 295,
      vy: 500,
      consecutiveGaps: 2,
      cylinderRotation: 0
    });

    let bounced = false;
    let crashed = false;

    physics.update(
      0.02,
      player,
      [testRing],
      [],
      particles,
      () => {
        crashed = true;
      },
      undefined,
      undefined,
      () => {
        bounced = true;
      }
    );

    expect(crashed).toBe(false);
    expect(bounced).toBe(true);
    expect(player.vy).toBeLessThan(0);
    expect(player.consecutiveGaps).toBe(0);
  });

  it('triggers crash when landing on HAZARD segment while not in Meteor mode', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const testRing: Ring = {
      id: 3,
      depth: 3,
      y: 400,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#ff0055',
      glow: 'rgba(255, 0, 85, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI, type: 'HAZARD' },
        { startAngle: Math.PI, endAngle: Math.PI * 2, type: 'SAFE' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    };

    const player = createMockPlayer({
      y: 395,
      vy: 500,
      isMeteor: false,
      cylinderRotation: 0
    });

    let crashed = false;
    physics.update(
      0.02,
      player,
      [testRing],
      [],
      particles,
      () => {
        crashed = true;
      }
    );

    expect(crashed).toBe(true);
    expect(player.vy).toBe(0);
  });
});

describe('Vortex Dive - Meteor Fireball State Seam', () => {
  it('ignites Meteor Fireball mode upon 3 consecutive gap passages with finite duration', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const rings: Ring[] = [1, 2, 3].map((d) => ({
      id: d,
      depth: d,
      y: d * 100,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI * 2, type: 'GAP' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    }));

    const player = createMockPlayer({
      y: 90,
      vy: 400,
      consecutiveGaps: 0,
      isMeteor: false
    });

    // Pass ring 1
    physics.update(0.04, player, [rings[0]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(1);

    // Pass ring 2
    player.y = 190;
    physics.update(0.04, player, [rings[1]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(2);

    // Pass ring 3 -> Triggers Meteor Fireball Dive
    player.y = 290;
    physics.update(0.04, player, [rings[2]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(3);
    expect(player.isMeteor).toBe(true);
    expect(player.meteorTimer).toBeGreaterThan(0);
    expect(player.meteorSmashesRemaining).toBe(4);
    expect(player.vy).toBeGreaterThanOrEqual(physics.meteorDiveSpeed);
  });

  it('ends Meteor mode when timer expires or remaining smashes hit zero', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const player = createMockPlayer({
      isMeteor: true,
      meteorTimer: 0.05,
      meteorSmashesRemaining: 1,
      vy: 2000
    });

    // Step physics past timer expiration
    physics.update(0.1, player, [], [], particles, () => {});

    // Meteor mode properly expires (does not last forever!)
    expect(player.isMeteor).toBe(false);
    expect(player.meteorTimer).toBe(0);
    expect(player.vy).toBeLessThan(1000);
  });

  it('triggers rapid plunge on user action (Piano Tiles flow)', () => {
    const physics = new PhysicsEngine();
    const player = createMockPlayer({ vy: 200 });

    physics.triggerPlunge(player);
    expect(player.isPlunging).toBe(true);
    expect(player.vy).toBeGreaterThanOrEqual(physics.plungeSpeed);
  });
});
