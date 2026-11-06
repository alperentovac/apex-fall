import { Particle, Shockwave, FloatingText } from '../types';

export class ParticleManager {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private texts: FloatingText[] = [];
  private nextTextId = 1;

  public update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.vRot) {
        p.rotation = (p.rotation || 0) + p.vRot * dt;
      }
      // Gravity for some spark types
      if (p.shape === 'spark') {
        p.vy += 800 * dt;
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - (sw.life / sw.maxLife);
      sw.radius = sw.maxRadius * Math.sin(progress * Math.PI * 0.5);
    }

    // Update floating texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.scale = 1 + 0.3 * Math.sin((1 - t.life / t.maxLife) * Math.PI);
    }
  }

  public spawnSparks(x: number, y: number, color: string, count = 12, speed = 250): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      const maxLife = 0.3 + Math.random() * 0.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        shape: 'spark'
      });
    }
  }

  public spawnJumpBurst(x: number, y: number, launchAngle: number): void {
    // Burst opposite to launch direction
    const oppAngle = launchAngle + Math.PI;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.2;
      const angle = oppAngle + spread;
      const spd = 120 + Math.random() * 260;
      const maxLife = 0.25 + Math.random() * 0.25;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 5,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 3.5,
        color: '#00f0ff',
        alpha: 1,
        shape: 'spark'
      });
    }
  }

  public spawnShockwave(x: number, y: number, maxRadius = 45, color = '#00f0ff'): void {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      life: 0.28,
      maxLife: 0.28,
      color,
      lineWidth: 3
    });
  }

  public spawnGemExplosion(x: number, y: number, color: string): void {
    // Shiny gem shards and golden sparks
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = 150 + Math.random() * 320;
      const maxLife = 0.4 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 3.5 + Math.random() * 4,
        color: Math.random() > 0.4 ? color : '#ffea00',
        alpha: 1,
        shape: 'square',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 15
      });
    }
    this.spawnShockwave(x, y, 60, color);
  }

  public spawnCrash(x: number, y: number): void {
    // Massive explosion of dust and red/orange rage sparks
    const count = 45;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // Upwards spread
      const spd = 200 + Math.random() * 500;
      const maxLife = 0.5 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 4 + Math.random() * 6,
        color: Math.random() > 0.5 ? '#ff0055' : '#ffaa00',
        alpha: 1,
        shape: 'spark'
      });
    }
    this.spawnShockwave(x, y, 120, '#ff0055');
  }

  public addFloatingText(x: number, y: number, text: string, color = '#00f0ff', size = 20): void {
    this.texts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      size,
      life: 0.85,
      maxLife: 0.85,
      vy: -75,
      scale: 1.4
    });
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    // Draw shockwaves
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = sw.lineWidth * alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = sw.color;
      ctx.stroke();
      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;

      if (p.shape === 'spark' || p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // Draw floating texts
    for (const t of this.texts) {
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${t.size}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = t.color;
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  public clear(): void {
    this.particles = [];
    this.shockwaves = [];
    this.texts = [];
  }
}
