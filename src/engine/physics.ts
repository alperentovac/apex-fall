import { Ball, TurnResult } from '../types';
import { WorldManager } from './world';

export class PhysicsEngine {
  public baseSpeed = 110;
  public maxSpeed = 400;
  public speedIncrementPerTurn = 0.8;
  public gravity = 1200;

  // Base tolerances (scale dynamically with speed up to 24px and 60px)
  public rPerfect = 16;
  public rGood = 42;

  public getTolerances(speed: number, isRapidBurst = false): { rPerfect: number; rGood: number } {
    const ratio = Math.min(1, Math.max(0, (speed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed)));
    let rPerfect = 16 + ratio * 8;
    let rGood = 42 + ratio * 18;

    if (isRapidBurst) {
      rPerfect = Math.round(rPerfect * 1.35);
      rGood = Math.round(rGood * 1.35);
    }

    return {
      rPerfect,
      rGood
    };
  }

  public calcSpeedForTurn(turnIndex: number): number {
    return Math.min(this.baseSpeed + turnIndex * this.speedIncrementPerTurn, this.maxSpeed);
  }

  public evaluateTurn(ball: Ball, world: WorldManager): TurnResult {
    const currentSeg = world.segments[ball.currentSegmentIndex];
    if (!currentSeg) {
      ball.isFalling = true;
      ball.vz = -50;
      return 'MISS';
    }

    const currentSpeed = Math.hypot(ball.vx, ball.vy) || this.baseSpeed;
    const isRapidBurst = currentSeg.patternType === 'RAPID_BURST';
    const { rPerfect, rGood } = this.getTolerances(currentSpeed, isRapidBurst);

    const corner = currentSeg.end;
    const distToCorner = Math.hypot(ball.x - corner.x, ball.y - corner.y);

    if (distToCorner <= rPerfect) {
      this.executeTurn(ball, world);
      return 'PERFECT';
    } else if (distToCorner <= rGood) {
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
    const speed = this.calcSpeedForTurn(nextIndex);
    world.ensureSegmentsAhead(nextIndex + 25, speed);

    const nextSeg = world.segments[nextIndex];

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

      // Platform alignment & lateral boundary protection:
      // When turning into nextSeg, clamp lateral position to stay safely on the new corridor.
      const isRapidBurst = nextSeg.patternType === 'RAPID_BURST';
      const maxLateralOffset = nextSeg.tileWidth * 0.45;

      if (nextSeg.dir === 'X') {
        if (isRapidBurst) {
          ball.y = nextSeg.start.y;
          ball.x = Math.max(ball.x, nextSeg.start.x);
        } else {
          const latDiff = ball.y - nextSeg.start.y;
          if (Math.abs(latDiff) > maxLateralOffset) {
            ball.y = nextSeg.start.y + Math.sign(latDiff) * maxLateralOffset;
          }
        }
      } else {
        if (isRapidBurst) {
          ball.x = nextSeg.start.x;
          ball.y = Math.max(ball.y, nextSeg.start.y);
        } else {
          const latDiff = ball.x - nextSeg.start.x;
          if (Math.abs(latDiff) > maxLateralOffset) {
            ball.x = nextSeg.start.x + Math.sign(latDiff) * maxLateralOffset;
          }
        }
      }
    }
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

    const currentSpeed = Math.hypot(ball.vx, ball.vy) || this.baseSpeed;
    const speedRatio = Math.min(1, Math.max(0, (currentSpeed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed)));

    // Adaptive lane centering: snappier centering at high speeds
    const centeringSpeed = 8 + speedRatio * 6;
    if (currSeg.dir === 'X') {
      ball.y += (currSeg.end.y - ball.y) * (1 - Math.exp(-centeringSpeed * stepDt));
    } else {
      ball.x += (currSeg.end.x - ball.x) * (1 - Math.exp(-centeringSpeed * stepDt));
    }

    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    const halfTile = currSeg.tileWidth / 2;
    const isRapid = currSeg.patternType === 'RAPID_BURST';

    // Check overshoot past segment corner and lateral edge margins
    if (currSeg.dir === 'X') {
      if (ball.x > currSeg.end.x + halfTile) {
        ball.isFalling = true;
        ball.vz = -100;
        ball.z += ball.vz * stepDt;
      } else {
        const isNearStartCorner = ball.x - currSeg.start.x < currSeg.tileWidth * 1.5;
        const allowedLateral = isRapid
          ? currSeg.tileWidth * 1.05
          : (isNearStartCorner
              ? currSeg.tileWidth * (0.95 + speedRatio * 0.15)
              : halfTile + 8 + speedRatio * 8);

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
        const isNearStartCorner = ball.y - currSeg.start.y < currSeg.tileWidth * 1.5;
        const allowedLateral = isRapid
          ? currSeg.tileWidth * 1.05
          : (isNearStartCorner
              ? currSeg.tileWidth * (0.95 + speedRatio * 0.15)
              : halfTile + 8 + speedRatio * 8);

        if (Math.abs(ball.x - currSeg.end.x) > allowedLateral) {
          ball.isFalling = true;
          ball.vz = -100;
          ball.z += ball.vz * stepDt;
        }
      }
    }
  }
}
