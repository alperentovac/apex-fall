import { Player, Platform, Gem } from '../types';
import { ParticleManager } from './particles';
import { sound } from './audio';

export class PhysicsEngine {
  public readonly gravity = 2200;
  public readonly maxJumpSpeed = 1100;
  public readonly minJumpSpeed = 480;
  public readonly terminalVelocity = 2100;
  public readonly worldWidth = 480;

  public update(
    dt: number,
    player: Player,
    platforms: Platform[],
    gems: Gem[],
    particles: ParticleManager,
    onCrash: (floorsLost: number) => void
  ): void {
    // Fast decay squash and stretch for high-octane feel
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 22);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 22);

    // Save trail history
    if (!player.onGround && Math.abs(player.vy) > 80) {
      player.trailHistory.unshift({
        x: player.x,
        y: player.y,
        alpha: 0.75,
        scale: player.scaleX
      });
      if (player.trailHistory.length > 10) {
        player.trailHistory.pop();
      }
    }
    // Fade trails
    for (const t of player.trailHistory) {
      t.alpha -= dt * 3.5;
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

    // Overdrive Super Power Active
    if (player.isOverdriveActive) {
      player.overdriveTimer -= dt;
      player.vy = -1950; // Sustained supersonic rocket ascent
      player.vx *= Math.pow(0.85, dt * 60);

      player.x += player.vx * dt;
      player.y += player.vy * dt;

      particles.spawnRocketFlame(player.x, player.y + player.height / 2);

      // Check passing floors and smashing through them
      for (const p of platforms) {
        if (p.floor > player.currentFloor && player.y <= p.y) {
          player.currentFloor = p.floor;
          if (player.currentFloor > player.maxFloorAchieved) {
            player.maxFloorAchieved = player.currentFloor;
          }
          player.comboStreak++;
          player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.3) * 10) / 10);
          player.currentRunSparks += Math.round(25 * player.comboMultiplier);
          particles.spawnSparks(p.x + p.width / 2, p.y, '#ffaa00', 6, 200);
        }
      }

      if (player.overdriveTimer <= 0) {
        player.isOverdriveActive = false;
        player.vy = -450; // Smooth exit float
        player.hasAirJump = true;
        particles.addFloatingText(player.x, player.y - 35, 'APEX BURST!', '#00f0ff', 24);
      }

      // Prevent regular falling physics while in overdrive
      return;
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

      // Decay input buffering & wall slide timers
      if (player.reboundBufferTimer > 0) player.reboundBufferTimer -= dt;

      // Snappy wall slide & Ninja wall bounce
      const halfW = player.width / 2;
      if (player.x - halfW <= 0) {
        player.x = halfW;
        player.wallSlideSide = 'left';
        player.wallSlideTimer = 0.22;
        if (player.vy > 100) player.vy = Math.min(player.vy, 260); // Wall friction slide
        particles.spawnSparks(player.x, player.y, '#00f0ff', 4, 140);
      } else if (player.x + halfW >= this.worldWidth) {
        player.x = this.worldWidth - halfW;
        player.wallSlideSide = 'right';
        player.wallSlideTimer = 0.22;
        if (player.vy > 100) player.vy = Math.min(player.vy, 260); // Wall friction slide
        particles.spawnSparks(player.x, player.y, '#00f0ff', 4, 140);
      } else {
        if (player.wallSlideTimer > 0) {
          player.wallSlideTimer -= dt;
          if (player.wallSlideTimer <= 0) player.wallSlideSide = null;
        }
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
                player.vy = -this.maxJumpSpeed * 1.2;
                player.scaleX = 0.65;
                player.scaleY = 1.55;
                player.hasAirJump = true;
                sound.playBounce();
                particles.spawnShockwave(player.x, platTop, 65, '#ff00aa');
                particles.spawnSparks(player.x, platTop, '#ff00aa', 16, 280);
                particles.addFloatingText(player.x, platTop - 30, 'BOOST!', '#ff00aa', 22);
                player.comboStreak++;
                player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.5) * 10) / 10);
                break;
              }

              // Check Perfect Rebound (Input Buffered Bunny Hop)
              if (player.reboundBufferTimer > 0 && p.floor > 0) {
                player.flowCombo++;
                player.isFlowActive = player.flowCombo >= 3;
                player.reboundBufferTimer = 0;
                player.hasAirJump = true;

                const speedMult = Math.min(1.4, 1.15 + player.flowCombo * 0.05);
                player.y = platTop - player.height / 2;
                player.vy = -this.maxJumpSpeed * speedMult;
                player.scaleX = 0.65;
                player.scaleY = 1.5;
                player.onGround = false;
                player.groundPlatformId = null;

                sound.playComboFanfare();
                particles.spawnShockwave(player.x, platTop, 85, '#ffea00');
                particles.spawnSparks(player.x, platTop, '#ffea00', 16, 260);
                particles.addFloatingText(
                  player.x,
                  platTop - 38,
                  player.isFlowActive ? `FLOW x${player.flowCombo}!` : 'PERFECT!',
                  '#ffea00',
                  24
                );

                // Update floor and combo
                if (p.floor > player.currentFloor) {
                  const gained = p.floor - player.currentFloor;
                  player.currentFloor = p.floor;
                  if (player.currentFloor > player.maxFloorAchieved) {
                    player.maxFloorAchieved = player.currentFloor;
                  }
                  player.overdriveEnergy = Math.min(100, player.overdriveEnergy + gained * 8);
                  player.comboStreak += gained;
                  player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.4) * 10) / 10);
                }
                break;
              }

              // Normal landing
              player.y = platTop - player.height / 2;
              player.vy = 0;
              player.vx = 0;
              player.onGround = true;
              player.hasAirJump = true;
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
                  // Overdrive energy gain on climb
                  player.overdriveEnergy = Math.min(100, player.overdriveEnergy + gained * 7);
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

    // Gem Collection & Magnetic Pull in Flow State
    for (const g of gems) {
      if (g.collected) continue;

      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnetic vacuum attraction during Flow State or Overdrive
      if ((player.isFlowActive || player.isOverdriveActive) && dist < 210) {
        g.x += (player.x - g.x) * dt * 7.5;
        g.y += (player.y - g.y) * dt * 7.5;
      }

      if (dist < player.width / 2 + g.radius + 8) {
        g.collected = true;
        const awarded = Math.round(g.value * player.comboMultiplier);
        player.currentRunSparks += awarded;
        player.totalSparks += awarded;
        player.comboStreak++;
        player.overdriveEnergy = Math.min(100, player.overdriveEnergy + 16);
        player.comboMultiplier = Math.min(64, Math.round((player.comboMultiplier + 0.2) * 10) / 10);
        sound.playGem(player.comboStreak);
        particles.spawnGemExplosion(g.x, g.y, g.color);
        particles.addFloatingText(g.x, g.y - 20, `+${awarded}`, '#ffea00', 22);
      }
    }
  }

  public applyAirControl(player: Player, dir: number, dt: number): void {
    if (!player.onGround) {
      player.vx += dir * 1650 * dt;
      const maxVx = 480;
      if (player.vx > maxVx) player.vx = maxVx;
      if (player.vx < -maxVx) player.vx = -maxVx;
    }
  }

  public triggerWallJump(player: Player, particles: ParticleManager): boolean {
    if (player.wallSlideSide !== null) {
      const isLeft = player.wallSlideSide === 'left';
      player.wallSlideSide = null;
      player.wallSlideTimer = 0;
      player.hasAirJump = true;
      player.onGround = false;

      // Diagonal wall kick away from the wall
      player.vx = isLeft ? 520 : -520;
      player.vy = -this.maxJumpSpeed * 0.95;
      player.scaleX = 0.7;
      player.scaleY = 1.45;

      sound.playJump(0.9);
      particles.spawnShockwave(player.x, player.y, 60, '#00f0ff');
      particles.spawnSparks(player.x, player.y, '#00f0ff', 14, 250);
      particles.addFloatingText(player.x, player.y - 30, 'WALL KICK!', '#00f0ff', 22);
      return true;
    }
    return false;
  }

  public triggerAirJump(player: Player, particles: ParticleManager): boolean {
    if (!player.onGround && player.hasAirJump) {
      player.hasAirJump = false;
      player.vy = -this.maxJumpSpeed * 0.9;
      player.scaleX = 0.7;
      player.scaleY = 1.45;
      sound.playJump(0.9);
      particles.spawnShockwave(player.x, player.y + player.height / 2, 55, '#ff00aa');
      particles.spawnSparks(player.x, player.y, '#ff00aa', 14, 240);
      particles.addFloatingText(player.x, player.y - 25, 'AIR BOOST!', '#ff00aa', 20);
      return true;
    }
    return false;
  }

  public activateOverdrive(player: Player, particles: ParticleManager): boolean {
    if (player.overdriveEnergy >= 100 && !player.isOverdriveActive) {
      player.isOverdriveActive = true;
      player.overdriveTimer = 2.4;
      player.overdriveEnergy = 0;
      player.onGround = false;
      player.groundPlatformId = null;
      player.hasAirJump = true;
      sound.playRocketRoar();
      particles.spawnShockwave(player.x, player.y, 110, '#ffaa00');
      particles.spawnSparks(player.x, player.y, '#ff0055', 25, 360);
      particles.addFloatingText(player.x, player.y - 45, 'HYPER ROCKET!', '#ffaa00', 30);
      return true;
    }
    return false;
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
