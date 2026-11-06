import { Player, Platform, Gem } from '../types';
import { ParticleManager } from './particles';
import { sound } from './audio';

export class PhysicsEngine {
  public readonly gravity = 1550;
  public readonly maxJumpSpeed = 880;
  public readonly minJumpSpeed = 380;
  public readonly terminalVelocity = 1450;
  public readonly worldWidth = 480;

  public update(
    dt: number,
    player: Player,
    platforms: Platform[],
    gems: Gem[],
    particles: ParticleManager,
    onCrash: (floorsLost: number) => void
  ): void {
    // Decay squash and stretch
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 12);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 12);

    // Save trail history
    if (!player.onGround && Math.abs(player.vy) > 100) {
      player.trailHistory.unshift({
        x: player.x,
        y: player.y,
        alpha: 0.65,
        scale: player.scaleX
      });
      if (player.trailHistory.length > 8) {
        player.trailHistory.pop();
      }
    }
    // Fade trails
    for (const t of player.trailHistory) {
      t.alpha -= dt * 2.5;
    }

    // If on ground and attached to moving platform
    if (player.onGround && player.groundPlatformId !== null) {
      const plat = platforms.find(p => p.id === player.groundPlatformId && !p.isBroken);
      if (plat) {
        if (plat.type === 'MOVING' && plat.vx !== undefined) {
          player.x += plat.vx * dt;
          player.x = Math.max(player.width / 2, Math.min(this.worldWidth - player.width / 2, player.x));
        }
        if (plat.type === 'CRUMBLING' && !plat.isCrumbling) {
          plat.isCrumbling = true;
          plat.crumbleTimer = 0.75;
          sound.playCrumble();
        }
      } else {
        // Platform broken under feet
        player.onGround = false;
        player.groundPlatformId = null;
      }
    }

    if (!player.onGround) {
      // Apply gravity
      player.vy += this.gravity * dt;
      if (player.vy > this.terminalVelocity) {
        player.vy = this.terminalVelocity;
      }

      // Air resistance
      player.vx *= Math.pow(0.988, dt * 60);

      // Move player
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      // Wall bounce
      const halfW = player.width / 2;
      if (player.x - halfW < 0) {
        player.x = halfW;
        player.vx = -player.vx * 0.65;
        particles.spawnSparks(player.x, player.y, '#00f0ff', 6, 160);
      } else if (player.x + halfW > this.worldWidth) {
        player.x = this.worldWidth - halfW;
        player.vx = -player.vx * 0.65;
        particles.spawnSparks(player.x, player.y, '#00f0ff', 6, 160);
      }

      // Track falling speed and distance (Only Up terror)
      if (player.vy > 400) {
        if (!player.isFallingFast) {
          player.isFallingFast = true;
          player.fallStartY = player.y;
        }
        player.fallDistance = player.y - player.fallStartY;
        sound.updateWindIntensity(player.vy);
      } else {
        player.isFallingFast = false;
        sound.updateWindIntensity(0);
      }

      // Platform Landing Collision (only when falling downwards)
      if (player.vy > 0) {
        const footY = player.y + player.height / 2;
        const prevFootY = footY - player.vy * dt;

        for (const p of platforms) {
          if (p.isBroken) continue;

          // Check if foot crosses top of platform
          const platTop = p.y;
          const leftBound = p.x - player.width * 0.35;
          const rightBound = p.x + p.width + player.width * 0.35;

          if (player.x >= leftBound && player.x <= rightBound) {
            if (prevFootY <= platTop + 8 && footY >= platTop) {
              // Landed on platform!
              if (p.type === 'BOUNCY') {
                // Trampoline bounce!
                player.y = platTop - player.height / 2;
                player.vy = -this.maxJumpSpeed * 1.15;
                player.scaleX = 0.7;
                player.scaleY = 1.45;
                sound.playBounce();
                particles.spawnShockwave(player.x, platTop, 60, '#ff00aa');
                particles.spawnSparks(player.x, platTop, '#ff00aa', 14, 250);
                particles.addFloatingText(player.x, platTop - 30, 'BOOST!', '#ff00aa', 22);
                player.comboStreak++;
                player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.5) * 10) / 10);
                break;
              }

              // Normal landing
              player.y = platTop - player.height / 2;
              player.vy = 0;
              player.vx = 0;
              player.onGround = true;
              player.groundPlatformId = p.id;
              player.scaleX = 1.4;
              player.scaleY = 0.65;
              sound.playLand();
              sound.updateWindIntensity(0);

              // Check if saved from a giant fall
              if (player.fallDistance > 250 && p.floor > 0) {
                particles.addFloatingText(player.x, platTop - 40, 'KURTULDUN!', '#00ffcc', 24);
                particles.spawnShockwave(player.x, platTop, 80, '#00ffcc');
              } else {
                particles.spawnShockwave(player.x, platTop, 40, p.color);
              }

              // Check if crashed at Ground (Floor 0)
              if (p.floor === 0 && player.fallDistance > 300) {
                const floorsLost = player.currentFloor;
                player.currentFloor = 0;
                player.comboMultiplier = 1.0;
                player.comboStreak = 0;
                sound.playCrash();
                particles.spawnCrash(player.x, platTop);
                onCrash(floorsLost);
              } else {
                // Update current floor
                if (p.floor > player.currentFloor) {
                  const gained = p.floor - player.currentFloor;
                  player.currentFloor = p.floor;
                  if (player.currentFloor > player.maxFloorAchieved) {
                    player.maxFloorAchieved = player.currentFloor;
                  }
                  // Streak reward
                  player.comboStreak += gained;
                  player.comboMultiplier = Math.min(64, 1 + player.comboStreak * 0.25);
                  player.currentRunSparks += Math.round(15 * player.comboMultiplier);
                  particles.addFloatingText(player.x, platTop - 25, `+${Math.round(15 * player.comboMultiplier)}`, '#00f0ff', 18);
                  
                  if (player.comboStreak % 5 === 0) {
                    sound.playComboFanfare();
                    particles.addFloatingText(player.x, platTop - 55, `x${player.comboMultiplier.toFixed(1)} COMBO!`, '#ff00aa', 26);
                  }
                }
              }

              player.fallDistance = 0;
              player.isFallingFast = false;
              break;
            }
          }
        }
      }
    }

    // Gem Collection
    for (const g of gems) {
      if (g.collected) continue;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < player.width / 2 + g.radius + 6) {
        g.collected = true;
        const awarded = Math.round(g.value * player.comboMultiplier);
        player.currentRunSparks += awarded;
        player.totalSparks += awarded;
        player.comboStreak++;
        player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.2) * 10) / 10);
        sound.playGem(player.comboStreak);
        particles.spawnGemExplosion(g.x, g.y, g.color);
        particles.addFloatingText(g.x, g.y - 20, `+${awarded}`, '#ffea00', 22);
      }
    }
  }

  public launchJump(player: Player, angle: number, power: number, particles: ParticleManager): void {
    if (!player.onGround) return;

    player.onGround = false;
    player.groundPlatformId = null;

    const clampedPower = Math.max(0.15, Math.min(1, power));
    const speed = this.minJumpSpeed + clampedPower * (this.maxJumpSpeed - this.minJumpSpeed);

    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;

    // Launch juice
    player.scaleX = 0.65;
    player.scaleY = 1.5;
    sound.playJump(clampedPower);
    particles.spawnJumpBurst(player.x, player.y + player.height / 2, angle);
  }

  public getTrajectoryPoints(player: Player, angle: number, power: number, count = 20): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const clampedPower = Math.max(0.15, Math.min(1, power));
    const speed = this.minJumpSpeed + clampedPower * (this.maxJumpSpeed - this.minJumpSpeed);

    let simX = player.x;
    let simY = player.y;
    let simVx = Math.cos(angle) * speed;
    let simVy = Math.sin(angle) * speed;
    const simDt = 0.038;

    for (let i = 0; i < count; i++) {
      simVy += this.gravity * simDt;
      simVx *= 0.99;
      simX += simVx * simDt;
      simY += simVy * simDt;

      // Bounce off walls in trajectory
      const halfW = player.width / 2;
      if (simX - halfW < 0) {
        simX = halfW;
        simVx = -simVx * 0.65;
      } else if (simX + halfW > this.worldWidth) {
        simX = this.worldWidth - halfW;
        simVx = -simVx * 0.65;
      }

      points.push({ x: simX, y: simY });
    }

    return points;
  }
}
