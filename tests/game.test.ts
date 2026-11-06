import { describe, it, expect } from 'vitest';
import { WorldManager } from '../src/engine/world';
import { PhysicsEngine } from '../src/engine/physics';
import { ParticleManager } from '../src/engine/particles';
import { Player } from '../src/types';

describe('Apex Fall Game Logic', () => {
  it('generates vertical tower platforms and gems progressively', () => {
    const world = new WorldManager();
    expect(world.platforms.length).toBeGreaterThan(20);
    expect(world.gems.length).toBeGreaterThan(5);

    // Floor 0 is ground
    const ground = world.platforms.find(p => p.floor === 0);
    expect(ground).toBeDefined();
    expect(ground?.width).toBe(world.worldWidth);

    // Subsequent floors ascend vertically (y decreases)
    const floor1 = world.platforms.find(p => p.floor === 1);
    const floor5 = world.platforms.find(p => p.floor === 5);
    expect(floor1).toBeDefined();
    expect(floor5).toBeDefined();
    expect(floor5!.y).toBeLessThan(floor1!.y);
  });

  it('calculates trajectory prediction arc correctly', () => {
    const physics = new PhysicsEngine();
    const player: Player = {
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
      charge: 0.8,
      aimAngle: -Math.PI / 2,
      aimLength: 100,
      scaleX: 1,
      scaleY: 1,
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
      trailHistory: []
    };

    const points = physics.getTrajectoryPoints(player, -Math.PI / 2, 0.8, 15);
    expect(points.length).toBe(15);
    // Trajectory should start moving upward (y decreases)
    expect(points[1].y).toBeLessThan(points[0].y);
  });

  it('handles landing and combo multiplier progression', () => {
    const physics = new PhysicsEngine();
    const world = new WorldManager();
    const particles = new ParticleManager();

    const player: Player = {
      x: 240,
      y: 700,
      vx: 0,
      vy: 300, // Falling downwards
      width: 26,
      height: 26,
      onGround: false,
      groundPlatformId: null,
      rotation: 0,
      isCharging: false,
      charge: 0,
      aimAngle: -Math.PI / 2,
      aimLength: 0,
      scaleX: 1,
      scaleY: 1,
      currentFloor: 0,
      maxFloorAchieved: 0,
      totalSparks: 0,
      currentRunSparks: 0,
      comboMultiplier: 1.0,
      comboStreak: 0,
      isFallingFast: false,
      fallStartY: 700,
      fallDistance: 0,
      maxFallRecorded: 0,
      trailHistory: []
    };

    // Simulate physics step onto floor 1 platform
    const targetPlat = world.platforms.find(p => p.floor === 1)!;
    player.x = targetPlat.x + targetPlat.width / 2;
    player.y = targetPlat.y - player.height / 2;
    player.vy = 200;

    let crashed = false;
    physics.update(0.016, player, world.platforms, world.gems, particles, () => {
      crashed = true;
    });

    expect(crashed).toBe(false);
    expect(player.onGround).toBe(true);
    expect(player.currentFloor).toBe(1);
    expect(player.comboMultiplier).toBeGreaterThan(1.0);
  });

  it('triggers crash callback when falling all the way to ground floor', () => {
    const physics = new PhysicsEngine();
    const world = new WorldManager();
    const particles = new ParticleManager();

    const player: Player = {
      x: 240,
      y: world.groundY - 13,
      vx: 0,
      vy: 1200, // Hard terminal fall
      width: 26,
      height: 26,
      onGround: false,
      groundPlatformId: null,
      rotation: 0,
      isCharging: false,
      charge: 0,
      aimAngle: -Math.PI / 2,
      aimLength: 0,
      scaleX: 1,
      scaleY: 1,
      currentFloor: 25,
      maxFloorAchieved: 25,
      totalSparks: 500,
      currentRunSparks: 500,
      comboMultiplier: 6.5,
      comboStreak: 25,
      isFallingFast: true,
      fallStartY: 100,
      fallDistance: 700,
      maxFallRecorded: 700,
      trailHistory: []
    };

    let lostFloors = 0;
    physics.update(0.016, player, world.platforms, world.gems, particles, (floors) => {
      lostFloors = floors;
    });

    expect(lostFloors).toBe(25);
    expect(player.currentFloor).toBe(0);
    expect(player.comboMultiplier).toBe(1.0);
  });
});
