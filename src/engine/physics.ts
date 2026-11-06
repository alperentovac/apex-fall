import { Player, Ring, RingSegment, Gem } from '../types';
import { ParticleManager } from './particles';
import { sound } from './audio';

export interface CollisionResult {
  hit: boolean;
  ring?: Ring;
  segment?: RingSegment;
  action: 'PASS_GAP' | 'BOUNCE' | 'SMASH' | 'CRASH' | 'NONE';
}

export class PhysicsEngine {
  // Accessible, gentle base gravity that ramps up smoothly with depth (Piano Tiles progression)
  public readonly baseGravity = 1250;
  public readonly bounceSpeed = 500;
  public readonly baseTerminalVelocity = 1250;
  public readonly meteorDiveSpeed = 1900;
  public readonly worldWidth = 480;
  public readonly contactAngle = Math.PI / 2; // Front of the ellipse (facing camera)

  public update(
    dt: number,
    player: Player,
    rings: Ring[],
    gems: Gem[],
    particles: ParticleManager,
    onCrash: () => void,
    onPassGap?: (ring: Ring) => void,
    onSmashRing?: (ring: Ring) => void,
    onBounce?: (ring: Ring) => void
  ): void {
    // Decay squash and stretch
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 20);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 20);

    // Aerodynamic diving trails
    player.trailHistory.unshift({
      x: player.x,
      y: player.y,
      alpha: player.isMeteor ? 0.9 : 0.65,
      scale: player.scaleX,
      isMeteor: player.isMeteor
    });
    if (player.trailHistory.length > 8) {
      player.trailHistory.pop();
    }
    for (const t of player.trailHistory) {
      t.alpha -= dt * (player.isMeteor ? 3.0 : 4.0);
    }

    // Meteor mode countdown (finite duration)
    if (player.isMeteor) {
      player.meteorTimer -= dt;
      if (player.meteorTimer <= 0) {
        this.deactivateMeteor(player);
      }
    }

    // Progressive speed scaling: starts gentle, accelerates smoothly with depth
    const depthProgress = Math.min(player.currentDepth * 0.012, 0.6);
    const effectiveGravity = this.baseGravity * (1 + depthProgress);
    const effectiveTerminalVelocity = player.isMeteor
      ? this.meteorDiveSpeed
      : this.baseTerminalVelocity + player.currentDepth * 15;

    // Apply gravity
    player.vy += effectiveGravity * dt;
    if (player.vy > effectiveTerminalVelocity) {
      player.vy = effectiveTerminalVelocity;
    }

    const prevY = player.y;
    const newY = player.y + player.vy * dt;

    // Check collision with rings
    if (player.vy > 0) {
      for (const ring of rings) {
        if (ring.isBroken) continue;

        // Check if player passes ring level
        if (prevY <= ring.y && newY >= ring.y) {
          const result = this.resolveRingCollision(player, ring);

          if (result.action === 'CRASH') {
            player.y = ring.y;
            player.vy = 0;
            this.deactivateMeteor(player);
            sound.playCrash();
            particles.spawnCrash(player.x, player.y);
            onCrash();
            return;
          }

          if (result.action === 'SMASH') {
            ring.isBroken = true;
            ring.passed = true;
            player.currentDepth = ring.depth;
            if (player.currentDepth > player.maxDepthAchieved) {
              player.maxDepthAchieved = player.currentDepth;
            }
            player.comboMultiplier = Math.min(32, Math.round((player.comboMultiplier + 0.5) * 10) / 10);
            const smashPoints = Math.round(100 * player.comboMultiplier);
            player.score += smashPoints;

            sound.playShatter();
            particles.spawnRingShatter(player.x, ring.y, '#ff003b');
            particles.spawnShockwave(player.x, ring.y, 80, '#ffaa00');
            particles.addFloatingText(player.x, ring.y - 30, `SMASH +${smashPoints}!`, '#ffaa00', 26);

            player.meteorSmashesRemaining--;
            if (player.meteorSmashesRemaining <= 0) {
              this.deactivateMeteor(player);
            }

            onSmashRing?.(ring);
          } else if (result.action === 'BOUNCE') {
            // Rhythmic bounce on safe platform
            player.y = ring.y - 2;
            player.vy = -this.bounceSpeed;
            player.consecutiveGaps = 0;
            this.deactivateMeteor(player);

            player.scaleX = 1.35;
            player.scaleY = 0.65;

            sound.playBounce();
            particles.spawnBounce(player.x, ring.y, ring.color);
            particles.spawnShockwave(player.x, ring.y, 35, ring.color);

            onBounce?.(ring);
            break;
          } else if (result.action === 'PASS_GAP') {
            ring.passed = true;
            player.consecutiveGaps++;
            player.perfectDropStreak++;
            player.currentDepth = ring.depth;
            if (player.currentDepth > player.maxDepthAchieved) {
              player.maxDepthAchieved = player.currentDepth;
            }

            // Hole color shift
            player.colorThemeIndex = (player.colorThemeIndex + 1) % 7;

            // Rhythmic speed boost for chained drops
            player.vy = Math.max(player.vy, 460 + player.consecutiveGaps * 100);

            player.comboMultiplier = Math.min(32, Math.round((player.comboMultiplier + 0.3) * 10) / 10);
            const passPoints = Math.round(25 * player.comboMultiplier);
            player.score += passPoints;

            // Trigger Meteor Fireball Dive at 3+ consecutive gaps
            if (player.consecutiveGaps >= 3 && !player.isMeteor) {
              player.isMeteor = true;
              player.meteorTimer = 4.0;
              player.meteorMaxTimer = 4.0;
              player.meteorSmashesRemaining = 4;
              player.vy = Math.max(player.vy, this.meteorDiveSpeed);

              sound.playMeteorIgnite();
              sound.startCatMusic();
              particles.spawnShockwave(player.x, ring.y, 100, '#ff3300');
              particles.addFloatingText(player.x, ring.y - 45, 'METEOR CRUSH!', '#ff3300', 30);
            } else {
              sound.playPianoTileNote(player.consecutiveGaps);
              particles.spawnPassSparks(player.x, ring.y, ring.color);
              particles.addFloatingText(player.x, ring.y - 25, `+${passPoints}`, '#00f0ff', 20);
            }

            player.scaleX = 0.8;
            player.scaleY = 1.3;

            onPassGap?.(ring);
          }
        }
      }
    }

    // Apply movement
    player.y = newY;
    player.isFallingFast = player.vy > 750 || player.isMeteor;

    // Meteor flame particle
    if (player.isMeteor) {
      particles.spawnMeteorFlame(player.x, player.y);
    }

    // Collect gems
    for (const g of gems) {
      if (g.collected) continue;

      const ring = rings.find((r) => r.id === g.ringId);
      const ringRot = ring ? ring.rotation : 0;
      const totalAngle = (g.angle + ringRot + player.cylinderRotation) % (Math.PI * 2);
      const normalizedAngle = totalAngle < 0 ? totalAngle + Math.PI * 2 : totalAngle;

      let diff = Math.abs(normalizedAngle - this.contactAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      if (diff < 0.35 && Math.abs(player.y - g.y) < 36) {
        g.collected = true;
        player.totalGems++;
        const awarded = Math.round(g.value * player.comboMultiplier);
        player.score += awarded;
        sound.playGem(player.consecutiveGaps + 1);
        particles.spawnGemExplosion(player.x, g.y, g.color);
        particles.addFloatingText(player.x, g.y - 25, `💎 +${awarded}`, '#ffea00', 22);
      }
    }
  }

  public deactivateMeteor(player: Player): void {
    if (!player.isMeteor) return;
    player.isMeteor = false;
    player.meteorTimer = 0;
    player.meteorSmashesRemaining = 0;
    sound.stopCatMusic();
    player.vy = Math.min(player.vy, 450); // Gentle smooth deceleration
  }

  public resolveRingCollision(player: Player, ring: Ring): CollisionResult {
    let relAngle = (this.contactAngle - (ring.rotation + player.cylinderRotation)) % (Math.PI * 2);
    if (relAngle < 0) relAngle += Math.PI * 2;

    let targetSegment: RingSegment | undefined;
    for (const seg of ring.segments) {
      if (relAngle >= seg.startAngle && relAngle < seg.endAngle) {
        targetSegment = seg;
        break;
      }
    }
    if (!targetSegment) {
      targetSegment = ring.segments[ring.segments.length - 1];
    }

    if (targetSegment.type === 'GAP') {
      return { hit: false, ring, segment: targetSegment, action: 'PASS_GAP' };
    }

    if (targetSegment.type === 'HAZARD') {
      if (player.isMeteor) {
        return { hit: true, ring, segment: targetSegment, action: 'SMASH' };
      }
      return { hit: true, ring, segment: targetSegment, action: 'CRASH' };
    }

    // SAFE pad
    if (player.isMeteor) {
      return { hit: true, ring, segment: targetSegment, action: 'SMASH' };
    }
    return { hit: true, ring, segment: targetSegment, action: 'BOUNCE' };
  }

  public applyRotation(player: Player, deltaAngle: number): void {
    player.cylinderRotation = (player.cylinderRotation + deltaAngle) % (Math.PI * 2);
    if (player.cylinderRotation < 0) {
      player.cylinderRotation += Math.PI * 2;
    }
  }

  public applySteering(player: Player, dir: number, dt: number): void {
    const steerSpeed = 4.2;
    this.applyRotation(player, dir * steerSpeed * dt);
  }
}
