import { describe, it, expect } from 'vitest';
import { WorldManager } from '../src/engine/world';
import { PhysicsEngine } from '../src/engine/physics';
import { ParticleManager } from '../src/engine/particles';
import { Player } from '../src/types';

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    x: 240,
    y: 800,
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
    flowCombo: 0,
    isFlowActive: false,
    reboundBufferTimer: 0,
    wallSlideSide: null,
    wallSlideTimer: 0,
    currentFloor: 0,
    maxFloorAchieved: 0,
    totalSparks: 0,
    currentRunSparks: 0,
    comboMultiplier: 1.0,
    comboStreak: 0,
    isFallingFast: false,
    fallStartY: 800,
    fallDistance: 0,
    maxFallRecorded: 0,
    trailHistory: [],
    ...overrides
  };
}

describe('Apex Fall Game Logic', () => {
  it('generates vertical tower platforms and gems progressively', () => {
    const world = new WorldManager();
    expect(world.platforms.length).toBeGreaterThan(20);
    expect(world.gems.length).toBeGreaterThan(5);

    const ground = world.platforms.find(p => p.floor === 0);
    expect(ground).toBeDefined();
    expect(ground?.width).toBe(world.worldWidth);

    const floor1 = world.platforms.find(p => p.floor === 1);
    const floor5 = world.platforms.find(p => p.floor === 5);
    expect(floor1).toBeDefined();
    expect(floor5).toBeDefined();
    expect(floor5!.y).toBeLessThan(floor1!.y);
  });

  it('calculates trajectory prediction arc correctly', () => {
    const physics = new PhysicsEngine();
    const player = createMockPlayer({ charge: 0.8 });

    const points = physics.getTrajectoryPoints(player, -Math.PI / 2, 0.8, 15);
    expect(points.length).toBe(15);
    expect(points[1].y).toBeLessThan(points[0].y);
  });

  it('handles landing, overdrive gain, and combo multiplier progression', () => {
    const physics = new PhysicsEngine();
    const world = new WorldManager();
    const particles = new ParticleManager();

    const targetPlat = world.platforms.find(p => p.floor === 1)!;
    const player = createMockPlayer({
      x: targetPlat.x + targetPlat.width / 2,
      y: targetPlat.y - 13,
      vy: 200,
      onGround: false,
      groundPlatformId: null
    });

    let crashed = false;
    physics.update(0.016, player, world.platforms, world.gems, particles, () => {
      crashed = true;
    });

    expect(crashed).toBe(false);
    expect(player.onGround).toBe(true);
    expect(player.currentFloor).toBe(1);
    expect(player.comboMultiplier).toBeGreaterThan(1.0);
    expect(player.overdriveEnergy).toBeGreaterThan(0);
  });

  it('triggers mid-air recovery boost and air control steering', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const player = createMockPlayer({
      y: 500,
      vy: 400,
      onGround: false,
      groundPlatformId: null,
      hasAirJump: true
    });

    const boosted = physics.triggerAirJump(player, particles);
    expect(boosted).toBe(true);
    expect(player.hasAirJump).toBe(false);
    expect(player.vy).toBeLessThan(0);

    physics.applyAirControl(player, 1, 0.05);
    expect(player.vx).toBeGreaterThan(0);
  });

  it('activates Hyper Rocket Overdrive when energy reaches 100%', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();
    const world = new WorldManager();

    const player = createMockPlayer({
      overdriveEnergy: 100,
      y: 600,
      currentFloor: 2
    });

    // Activation succeeds
    const activated = physics.activateOverdrive(player, particles);
    expect(activated).toBe(true);
    expect(player.isOverdriveActive).toBe(true);
    expect(player.overdriveEnergy).toBe(0);
    expect(player.overdriveTimer).toBeGreaterThan(2.0);

    // Rocket physics step shoots upward violently
    physics.update(0.02, player, world.platforms, world.gems, particles, () => {});
    expect(player.vy).toBeLessThan(-1800);
    expect(player.y).toBeLessThan(600);
  });

  it('triggers Ninja Wall-Kick when sliding against walls', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();

    const player = createMockPlayer({
      x: 13,
      wallSlideSide: 'left',
      onGround: false
    });

    const kicked = physics.triggerWallJump(player, particles);
    expect(kicked).toBe(true);
    expect(player.vx).toBeGreaterThan(400); // Kicks to the right
    expect(player.vy).toBeLessThan(0); // Upward momentum
  });

  it('triggers Perfect Rebound (Bunny Hop) when input is buffered upon landing', () => {
    const physics = new PhysicsEngine();
    const particles = new ParticleManager();
    const world = new WorldManager();

    const targetPlat = world.platforms.find(p => p.floor === 2)!;
    const player = createMockPlayer({
      x: targetPlat.x + targetPlat.width / 2,
      y: targetPlat.y - 13,
      vy: 200,
      onGround: false,
      reboundBufferTimer: 0.15 // Buffered jump
    });

    physics.update(0.016, player, world.platforms, world.gems, particles, () => {});

    // Player does not stay on ground, instantly rebounds upward
    expect(player.onGround).toBe(false);
    expect(player.vy).toBeLessThan(-900);
    expect(player.flowCombo).toBe(1);
  });
});
