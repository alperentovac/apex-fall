import { Ball, TurnResult } from '../types';
import { WorldManager } from './world';

export class PhysicsEngine {
  public rPerfect = 16;
  public rGood = 42;
  public gravity = 1200;
  public baseSpeed = 115;

  public evaluateTurn(ball: Ball, world: WorldManager): TurnResult {
    const currentSeg = world.segments[ball.currentSegmentIndex];
    if (!currentSeg) {
      ball.isFalling = true;
      ball.vz = -50;
      return 'MISS';
    }

    const corner = currentSeg.end;
    const distToCorner = Math.hypot(ball.x - corner.x, ball.y - corner.y);

    if (distToCorner <= this.rPerfect) {
      this.executeTurn(ball, world);
      return 'PERFECT';
    } else if (distToCorner <= this.rGood) {
      this.executeTurn(ball, world);
      return 'GOOD';
    } else {
      // Missed: turned too early or in empty space
      ball.isFalling = true;
      ball.vz = -50;
      return 'MISS';
    }
  }

  private executeTurn(ball: Ball, world: WorldManager): void {
    const nextIndex = ball.currentSegmentIndex + 1;
    world.ensureSegmentsAhead(nextIndex + 20, Math.hypot(ball.vx, ball.vy) || this.baseSpeed);

    const nextSeg = world.segments[nextIndex];
    const speed = Math.hypot(ball.vx, ball.vy) || this.baseSpeed;

    if (nextSeg) {
      ball.dir = nextSeg.dir;
      if (ball.dir === 'X') {
        ball.vx = speed;
        ball.vy = 0;
      } else {
        ball.vx = 0;
        ball.vy = speed;
      }
      ball.currentSegmentIndex = nextIndex;
    }
    // Important: ball.x and ball.y are strictly PRESERVED on turn (no artificial snapping)
  }

  public update(dt: number, ball: Ball, world: WorldManager): void {
    let remaining = dt;
    const maxSubStep = 0.02; // 20ms substeps
    while (remaining > 0.0001) {
      const step = Math.min(remaining, maxSubStep);
      this.step(step, ball, world);
      remaining -= step;
    }
  }

  private step(stepDt: number, ball: Ball, world: WorldManager): void {
    if (ball.isFalling) {
      ball.vz -= this.gravity * stepDt;
      ball.z += ball.vz * stepDt;
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;
      ball.fallTimer += stepDt;
      return;
    }

    const currSeg = world.segments[ball.currentSegmentIndex];
    if (!currSeg) {
      ball.isFalling = true;
      ball.vz = -50;
      return;
    }

    // Smoothly guide lateral position towards lane centerline so turning doesn't slide off
    if (currSeg.dir === 'X') {
      ball.y += (currSeg.end.y - ball.y) * (1 - Math.exp(-6 * stepDt));
    } else {
      ball.x += (currSeg.end.x - ball.x) * (1 - Math.exp(-6 * stepDt));
    }

    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    const halfTile = currSeg.tileWidth / 2;

    // Check overshoot past segment corner and lateral edge margins
    if (currSeg.dir === 'X') {
      if (ball.x > currSeg.end.x + halfTile) {
        ball.isFalling = true;
        ball.vz = -100;
        ball.z += ball.vz * stepDt;
      } else {
        // At corner junction zone, junction platform is wider to absorb incoming turns
        const isNearStartCorner = ball.x - currSeg.start.x < currSeg.tileWidth;
        const allowedLateral = isNearStartCorner ? currSeg.tileWidth * 0.95 : halfTile + 4;
        if (Math.abs(ball.y - currSeg.end.y) > allowedLateral) {
          ball.isFalling = true;
          ball.vz = -100;
          ball.z += ball.vz * stepDt;
        }
      }
    } else {
      if (ball.y > currSeg.end.y + halfTile) {
        ball.isFalling = true;
        ball.vz = -100;
        ball.z += ball.vz * stepDt;
      } else {
        const isNearStartCorner = ball.y - currSeg.start.y < currSeg.tileWidth;
        const allowedLateral = isNearStartCorner ? currSeg.tileWidth * 0.95 : halfTile + 4;
        if (Math.abs(ball.x - currSeg.end.x) > allowedLateral) {
          ball.isFalling = true;
          ball.vz = -100;
          ball.z += ball.vz * stepDt;
        }
      }
    }
  }
}
