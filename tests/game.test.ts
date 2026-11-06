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

describe('Vortex Dive - Option A Pure Flow & Zero Hazards Seam', () => {
  it('generates 4 discrete 90-degree quadrant segments with zero hazards', () => {
    const world = new WorldManager();
    expect(world.rings.length).toBeGreaterThan(20);

    for (const ring of world.rings) {
      expect(ring.segments.length).toBe(4);
      // Zero red hazards in entire game!
      const hazards = ring.segments.filter((s) => s.type === 'HAZARD');
      expect(hazards.length).toBe(0);

      // All segments are either GAP or SAFE
      for (const seg of ring.segments) {
        expect(['GAP', 'SAFE']).toContain(seg.type);
      }
    }
  });

  it('provides accessible wide openings on early rings (depth 0-5)', () => {
    const world = new WorldManager();
    const ring0 = world.rings.find((r) => r.depth === 0)!;
    expect(ring0).toBeDefined();

    const ring0Gaps = ring0.segments.filter((s) => s.type === 'GAP');
    expect(ring0Gaps.length).toBe(3); // 270° opening on ring 0!

    const ring3 = world.rings.find((r) => r.depth === 3)!;
    expect(ring3).toBeDefined();
    const ring3Gaps = ring3.segments.filter((s) => s.type === 'GAP');
    expect(ring3Gaps.length).toBeGreaterThanOrEqual(2); // At least 180° opening!
  });

  it('calculates smart directional guidance step correctly', () => {
    const physics = new PhysicsEngine();
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
        { startAngle: Math.PI * 0.5, endAngle: Math.PI, type: 'GAP' }, // Aligned with contactAngle (PI/2)
        { startAngle: Math.PI, endAngle: Math.PI * 1.5, type: 'SAFE' },
        { startAngle: Math.PI * 1.5, endAngle: Math.PI * 2, type: 'SAFE' }
      ],
      passed: false,
      isBroken: false,
      colorIndex: 0
    };

    const player = createMockPlayer({ cylinderRotation: 0 });

    // When aligned directly with GAP:
    const guideAligned = physics.getGuideDirection(player, mockRing);
    expect(guideAligned.step).toBe(0);
    expect(guideAligned.label).toBe('DÜŞÜŞ HAZIR');

    // Rotate player so gap is to the right
    player.cylinderRotation = Math.PI * 0.5;
    const guideRotated = physics.getGuideDirection(player, mockRing);
    expect([-1, 1]).toContain(guideRotated.step);
  });
});

describe('Vortex Dive - Option A Collision & Rhythmic Seam', () => {
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
        { startAngle: 0, endAngle: Math.PI * 0.5, type: 'SAFE' },
        { startAngle: Math.PI * 0.5, endAngle: Math.PI, type: 'GAP' },
        { startAngle: Math.PI, endAngle: Math.PI * 1.5, type: 'SAFE' },
        { startAngle: Math.PI * 1.5, endAngle: Math.PI * 2, type: 'SAFE' }
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
    physics.update(
      0.02,
      player,
      [testRing],
      [],
      particles,
      () => {},
      () => {
        passedGap = true;
      }
    );

    expect(passedGap).toBe(true);
    expect(testRing.passed).toBe(true);
    expect(player.consecutiveGaps).toBe(1);
    expect(player.colorThemeIndex).toBe(1);
    expect(player.vy).toBeGreaterThan(400);
  });

  it('triggers safe bounce on SAFE landing pad without crashing', () => {
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

    // Never crashes on safe landing!
    expect(crashed).toBe(false);
    expect(bounced).toBe(true);
    expect(player.vy).toBeLessThan(0); // Bounced upward
    expect(player.consecutiveGaps).toBe(0); // Streak reset
  });
});

describe('Vortex Dive - Meteor Fireball & Snap Step Seams', () => {
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

    physics.update(0.04, player, [rings[0]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(1);

    player.y = 190;
    physics.update(0.04, player, [rings[1]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(2);

    player.y = 290;
    physics.update(0.04, player, [rings[2]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(3);
    expect(player.isMeteor).toBe(true);
    expect(player.meteorTimer).toBeGreaterThan(0);
    expect(player.meteorSmashesRemaining).toBe(4);
    expect(player.vy).toBeGreaterThanOrEqual(physics.meteorDiveSpeed);
  });

  it('snaps rotation by exact 90 degrees on left/right discrete step', () => {
    const physics = new PhysicsEngine();
    const player = createMockPlayer({ cylinderRotation: 0 });

    physics.snapRotate(player, 1);
    expect(player.cylinderRotation).toBeCloseTo(Math.PI * 0.5, 4);

    physics.snapRotate(player, 1);
    expect(player.cylinderRotation).toBeCloseTo(Math.PI, 4);

    physics.snapRotate(player, -1);
    expect(player.cylinderRotation).toBeCloseTo(Math.PI * 0.5, 4);
  });

  it('progressively scales speed and gravity as depth increases (Piano Tiles flow)', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const shallowPlayer = createMockPlayer({ currentDepth: 0, y: 100, vy: 0 });
    physics.update(0.1, shallowPlayer, [], [], particles, () => {});

    const deepPlayer = createMockPlayer({ currentDepth: 30, y: 100, vy: 0 });
    physics.update(0.1, deepPlayer, [], [], particles, () => {});

    expect(deepPlayer.vy).toBeGreaterThan(shallowPlayer.vy);
  });
});
