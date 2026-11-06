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
    cylinderRotation: 0,
    rotationVelocity: 0,
    tiltAngle: 0,
    scaleX: 1,
    scaleY: 1,
    currentDepth: 0,
    maxDepthAchieved: 0,
    score: 0,
    totalGems: 0,
    comboMultiplier: 1.0,
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

      // Verify segments are contiguous and strictly non-overlapping
      for (let i = 0; i < ring.segments.length - 1; i++) {
        expect(ring.segments[i].endAngle).toBeCloseTo(ring.segments[i + 1].startAngle, 4);
      }
    }
  });

  it('progresses difficulty: early rings have wide gaps & no hazards, deeper rings include hazards', () => {
    const world = new WorldManager();
    const ring0 = world.rings.find((r) => r.depth === 0)!;
    expect(ring0).toBeDefined();

    // Ring 0 has gap and 0 hazards
    const ring0Hazards = ring0.segments.filter((s) => s.type === 'HAZARD');
    const ring0Gaps = ring0.segments.filter((s) => s.type === 'GAP');
    expect(ring0Hazards.length).toBe(0);
    expect(ring0Gaps.length).toBeGreaterThan(0);

    // Ring at depth 12 has hazards
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
      isBroken: false
    };

    // At rotation 0:
    // angle PI/4 (0.785) is in SAFE
    const segSafe = world.getSegmentAtAngle(mockRing, Math.PI * 0.25);
    expect(segSafe?.type).toBe('SAFE');

    // angle 0.75 * PI is in GAP
    const segGap = world.getSegmentAtAngle(mockRing, Math.PI * 0.75);
    expect(segGap?.type).toBe('GAP');

    // angle 1.25 * PI is in HAZARD
    const segHazard = world.getSegmentAtAngle(mockRing, Math.PI * 1.25);
    expect(segHazard?.type).toBe('HAZARD');

    // With ring rotation applied (rotate by PI/2):
    // What was at PI * 0.75 is now offset
    mockRing.rotation = Math.PI * 0.5;
    const segRotated = world.getSegmentAtAngle(mockRing, Math.PI * 0.75);
    // relAngle = 0.75*PI - 0.5*PI = 0.25*PI -> now SAFE
    expect(segRotated?.type).toBe('SAFE');
  });
});

describe('Vortex Dive - Angular Collision & Freefall Seam', () => {
  it('allows clean freefall passage through GAP segment and increments depth and streak', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    // Create a ring with a GAP aligned directly with player contactAngle (PI/2)
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
        { startAngle: Math.PI * 0.2, endAngle: Math.PI * 0.8, type: 'GAP' }, // Covers contactAngle (PI/2 = ~1.57)
        { startAngle: Math.PI * 0.8, endAngle: Math.PI * 2, type: 'SAFE' }
      ],
      passed: false,
      isBroken: false
    };

    const player = createMockPlayer({
      y: 195,
      vy: 400,
      cylinderRotation: 0
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
    expect(player.vy).toBeGreaterThan(400); // Continued falling downward
  });

  it('triggers safe bounce on SAFE landing pad, resetting consecutive gaps', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    // Ring with SAFE segment covering player contactAngle
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
      isBroken: false
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
    expect(player.vy).toBeLessThan(0); // Bounced upward
    expect(player.consecutiveGaps).toBe(0); // Streak reset on landing
  });

  it('triggers crash when landing on HAZARD segment while not in Meteor mode', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    // Ring with HAZARD segment covering contactAngle
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
      isBroken: false
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
  it('ignites Meteor Fireball mode upon 3 consecutive gap passages with bonus multiplier', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    // Three consecutive rings with aligned GAPs
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
      isBroken: false
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
    expect(player.isMeteor).toBe(false);

    // Pass ring 2
    player.y = 190;
    physics.update(0.04, player, [rings[1]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(2);
    expect(player.isMeteor).toBe(false);

    // Pass ring 3 -> Should trigger Meteor Fireball Dive!
    player.y = 290;
    physics.update(0.04, player, [rings[2]], [], particles, () => {});
    expect(player.consecutiveGaps).toBe(3);
    expect(player.isMeteor).toBe(true);
    expect(player.vy).toBeGreaterThanOrEqual(physics.meteorDiveSpeed);
    expect(player.comboMultiplier).toBeGreaterThan(1.5);
  });

  it('smashes cleanly through HAZARD segments during Meteor Fireball mode without crashing', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const hazardRing: Ring = {
      id: 99,
      depth: 5,
      y: 500,
      radius: 140,
      thickness: 26,
      rotation: 0,
      rotSpeed: 0,
      color: '#ff0055',
      glow: 'rgba(255, 0, 85, 0.5)',
      segments: [
        { startAngle: 0, endAngle: Math.PI * 2, type: 'HAZARD' } // Entire ring is hazard
      ],
      passed: false,
      isBroken: false
    };

    const player = createMockPlayer({
      y: 490,
      vy: 2000,
      isMeteor: true,
      consecutiveGaps: 3
    });

    let crashed = false;
    let smashed = false;

    physics.update(
      0.02,
      player,
      [hazardRing],
      [],
      particles,
      () => {
        crashed = true;
      },
      undefined,
      () => {
        smashed = true;
      }
    );

    // Did not crash! Smashed cleanly through!
    expect(crashed).toBe(false);
    expect(smashed).toBe(true);
    expect(hazardRing.isBroken).toBe(true);
    expect(hazardRing.passed).toBe(true);
    expect(player.score).toBeGreaterThan(0);
  });

  it('applies rotational steering and clamps cylinder angle in [0, 2*PI)', () => {
    const physics = new PhysicsEngine();
    const player = createMockPlayer({ cylinderRotation: 0 });

    physics.applyRotation(player, Math.PI);
    expect(player.cylinderRotation).toBeCloseTo(Math.PI, 4);

    physics.applyRotation(player, Math.PI * 1.5);
    // PI + 1.5*PI = 2.5*PI -> wraps to 0.5*PI
    expect(player.cylinderRotation).toBeCloseTo(Math.PI * 0.5, 4);

    physics.applyRotation(player, -Math.PI);
    // 0.5*PI - PI = -0.5*PI -> wraps to 1.5*PI
    expect(player.cylinderRotation).toBeCloseTo(Math.PI * 1.5, 4);
  });
});
