import { Ball, TurnResult } from '../types';
import { WorldManager } from './world';

export class PhysicsEngine {
  public rPerfect = 12;
  public rGood = 24;
  public gravity = 1400;
  public baseSpeed = 160;

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
    world.ensureSegmentsAhead(nextIndex + 15, Math.hypot(ball.vx, ball.vy) || this.baseSpeed);

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
    // Important: ball.x and ball.y are strictly PRESERVED (no position snapping)
  }

  public update(dt: number, ball: Ball, world: WorldManager): void {
    // Fixed substep loop to prevent physics tunneling
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

    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    const currSeg = world.segments[ball.currentSegmentIndex];
    if (!currSeg) {
      ball.isFalling = true;
      ball.vz = -50;
      return;
    }

    const halfTile = currSeg.tileWidth / 2;

    // Check overshoot past segment corner
    if (currSeg.dir === 'X') {
      if (ball.x > currSeg.end.x + halfTile) {
        ball.isFalling = true;
        ball.vz = -50;
      } else if (Math.abs(ball.y - currSeg.end.y) > halfTile) {
        ball.isFalling = true;
        ball.vz = -50;
      }
    } else {
      if (ball.y > currSeg.end.y + halfTile) {
        ball.isFalling = true;
        ball.vz = -50;
      } else if (Math.abs(ball.x - currSeg.end.x) > halfTile) {
        ball.isFalling = true;
        ball.vz = -50;
      }
    }
  }
}
