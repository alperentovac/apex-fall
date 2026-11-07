import { Particle } from '../types';
import { worldToScreen } from './world';

export class ParticleManager {
  public particles: Particle[] = [];
  private readonly maxParticles = 80;

  public spawnCornerSparks(pos: { x: number; y: number; z?: number }, count = 12): void {
    const colors = ['#00f0ff', '#ffe600', '#ffffff', '#38bdf8'];
    const z = pos.z ?? 0;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;

      this.particles.push({
        x: pos.x,
        y: pos.y,
        z: z + 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 40 + Math.random() * 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 2.5,
        alpha: 1.0,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.z !== undefined && p.vz !== undefined) {
        p.vz -= 300 * dt; // Gravity
        p.z += p.vz * dt;
      }
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    camera: { x: number; y: number; zoom?: number },
    viewport: { width: number; height: number }
  ): void {
    for (const p of this.particles) {
      if (p.alpha <= 0.02) continue;
      const s = worldToScreen({ x: p.x, y: p.y, z: p.z }, camera, viewport);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  public clear(): void {
    this.particles = [];
  }
}
