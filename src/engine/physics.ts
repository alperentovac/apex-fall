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
  public readonly gravity = 1850;
  public readonly bounceSpeed = 620;
  public readonly terminalVelocity = 2400;
  public readonly meteorDiveSpeed = 2300;
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
    // Decay squash and stretch juice
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 20);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 20);

    // Aerodynamic diving trails
    player.trailHistory.unshift({
      x: player.x,
      y: player.y,
      alpha: player.isMeteor ? 0.95 : 0.75,
      scale: player.scaleX,
      isMeteor: player.isMeteor
    });
    if (player.trailHistory.length > 12) {
      player.trailHistory.pop();
    }
    for (const t of player.trailHistory) {
      t.alpha -= dt * (player.isMeteor ? 3.0 : 4.5);
    }

    // Apply gravity
    player.vy += this.gravity * dt;
    const maxSpeed = player.isMeteor ? this.meteorDiveSpeed : this.terminalVelocity;
    if (player.vy > maxSpeed) {
      player.vy = maxSpeed;
    }

    const prevY = player.y;
    const newY = player.y + player.vy * dt;

    // Check collision with rings
    if (player.vy > 0) {
      for (const ring of rings) {
        if (ring.isBroken) continue;

        // Check if player trajectory intersects ring level
        if (prevY <= ring.y && newY >= ring.y) {
          const result = this.resolveRingCollision(player, ring);

          if (result.action === 'CRASH') {
            player.y = ring.y;
            player.vy = 0;
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
            const smashPoints = Math.round(80 * player.comboMultiplier);
            player.score += smashPoints;

            sound.playShatter();
            particles.spawnRingShatter(player.x, ring.y, '#ff0055');
            particles.spawnShockwave(player.x, ring.y, 90, '#ffaa00');
            particles.addFloatingText(player.x, ring.y - 30, `SMASH +${smashPoints}!`, '#ffaa00', 26);

            onSmashRing?.(ring);
            // Smashed through, continues downward
          } else if (result.action === 'BOUNCE') {
            player.y = ring.y - 2;
            player.vy = -this.bounceSpeed;
            player.consecutiveGaps = 0;
            player.isMeteor = false;
            player.scaleX = 1.35;
            player.scaleY = 0.65;

            sound.playBounce();
            particles.spawnBounce(player.x, ring.y, ring.color);
            particles.spawnShockwave(player.x, ring.y, 45, ring.color);

            onBounce?.(ring);
            break;
          } else if (result.action === 'PASS_GAP') {
            ring.passed = true;
            player.consecutiveGaps++;
            player.currentDepth = ring.depth;
            if (player.currentDepth > player.maxDepthAchieved) {
              player.maxDepthAchieved = player.currentDepth;
            }

            player.comboMultiplier = Math.min(32, Math.round((player.comboMultiplier + 0.3) * 10) / 10);
            const passPoints = Math.round(20 * player.comboMultiplier);
            player.score += passPoints;

            // Trigger Meteor Fireball Dive at 3+ consecutive gaps
            if (player.consecutiveGaps >= 3 && !player.isMeteor) {
              player.isMeteor = true;
              player.vy = Math.max(player.vy, this.meteorDiveSpeed);
              sound.playMeteorIgnite();
              particles.spawnShockwave(player.x, ring.y, 110, '#ff5500');
              particles.addFloatingText(player.x, ring.y - 45, 'METEOR DIVE!', '#ff3300', 30);
            } else {
              sound.playPassGap(player.consecutiveGaps);
              particles.spawnPassSparks(player.x, ring.y, ring.color);
              particles.addFloatingText(player.x, ring.y - 25, `+${passPoints}`, '#00f0ff', 20);
            }

            player.scaleX = 0.75;
            player.scaleY = 1.4;

            onPassGap?.(ring);
          }
        }
      }
    }

    // Apply movement
    player.y = newY;
    player.isFallingFast = player.vy > 900 || player.isMeteor;

    // Meteor flame particle burst
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

      // Angular distance to player contact point
      let diff = Math.abs(normalizedAngle - this.contactAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      if (diff < 0.32 && Math.abs(player.y - g.y) < 32) {
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

  public resolveRingCollision(player: Player, ring: Ring): CollisionResult {
    // Relative angle on the ring at the player's contact point
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
