import { Direction, PathSegment } from '../types';

export const ISO_COS = Math.cos(Math.PI / 6); // ~0.8660254037844386
export const ISO_SIN = Math.sin(Math.PI / 6); // 0.5

export function worldToScreen(
  pos: { x: number; y: number; z?: number },
  camera: { x: number; y: number; zoom?: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const zoom = camera.zoom ?? 1;
  const z = pos.z ?? 0;
  const relX = pos.x - camera.x;
  const relY = pos.y - camera.y;

  const sx = viewport.width / 2 + (relX - relY) * ISO_COS * zoom;
  const sy = viewport.height / 2 + (relX + relY) * ISO_SIN * zoom - z * zoom;

  return { x: sx, y: sy };
}

export function screenToWorld(
  screen: { x: number; y: number },
  camera: { x: number; y: number; zoom?: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const zoom = camera.zoom ?? 1;
  const sx = screen.x - viewport.width / 2;
  const sy = screen.y - viewport.height / 2;

  const dx = sx / (ISO_COS * zoom);
  const dy = sy / (ISO_SIN * zoom);

  const relX = (dx + dy) / 2;
  const relY = (dy - dx) / 2;

  return {
    x: relX + camera.x,
    y: relY + camera.y
  };
}

export class WorldManager {
  public segments: PathSegment[] = [];
  public tileWidth = 40;
  private rngSeed = 42;

  constructor() {
    this.reset();
  }

  public reset(seed = 42): void {
    this.rngSeed = seed;
    this.segments = [];

    // Starting runway: straight segment along X from (0, 0)
    const initialLength = 120;
    this.segments.push({
      index: 0,
      dir: 'X',
      start: { x: 0, y: 0 },
      end: { x: initialLength, y: 0 },
      length: initialLength,
      tileWidth: this.tileWidth
    });

    // Generate initial set of segments
    this.ensureSegmentsAhead(25, 160);
  }

  private random(): number {
    this.rngSeed = (this.rngSeed * 9301 + 49297) % 233280;
    return this.rngSeed / 233280;
  }

  public calcMinSegmentLength(speed: number): number {
    // Human reaction time guaranteed (min 0.28s)
    const minReactionTime = 0.28;
    return Math.max(60, speed * minReactionTime);
  }

  public ensureSegmentsAhead(targetCount: number, currentSpeed: number): void {
    while (this.segments.length < targetCount) {
      const last = this.segments[this.segments.length - 1];
      const nextDir: Direction = last.dir === 'X' ? 'Y' : 'X';
      const minLen = this.calcMinSegmentLength(currentSpeed);
      const length = Math.round(minLen + this.random() * (minLen * 1.2));

      const start = { x: last.end.x, y: last.end.y };
      const end = {
        x: nextDir === 'X' ? start.x + length : start.x,
        y: nextDir === 'Y' ? start.y + length : start.y
      };

      this.segments.push({
        index: this.segments.length,
        dir: nextDir,
        start,
        end,
        length,
        tileWidth: this.tileWidth
      });
    }
  }
}
