import { Particle, Shockwave, FloatingText } from '../types';

export class ParticleManager {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private texts: FloatingText[] = [];
  private nextTextId = 1;
  private readonly maxParticles = 60;

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
      if (p.shape === 'spark' || p.shape === 'fragment') {
        p.vy += 600 * dt;
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
      const progress = 1 - sw.life / sw.maxLife;
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
      t.scale = 1 + 0.25 * Math.sin((1 - t.life / t.maxLife) * Math.PI);
    }
  }

  private addParticle(p: Particle): void {
    if (this.particles.length < this.maxParticles) {
      this.particles.push(p);
    }
  }

  public spawnSparks(x: number, y: number, color: string, count = 10, speed = 240): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      const maxLife = 0.25 + Math.random() * 0.3;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 3,
        color,
        alpha: 1,
        shape: 'spark'
      });
    }
  }

  public spawnPassSparks(x: number, y: number, color = '#00f0ff'): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
      const spd = 120 + Math.random() * 240;
      const maxLife = 0.2 + Math.random() * 0.2;
      this.addParticle({
        x: x + (Math.random() - 0.5) * 35,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 3,
        color,
        alpha: 1,
        shape: 'spark'
      });
    }
    this.spawnShockwave(x, y, 35, color);
  }

  public spawnBounce(x: number, y: number, color = '#00f0ff'): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const spd = 100 + Math.random() * 200;
      const maxLife = 0.2 + Math.random() * 0.2;
      this.addParticle({
        x: x + (Math.random() - 0.5) * 25,
        y,
        vx: Math.cos(angle) * spd,
        vy: -Math.abs(Math.sin(angle) * spd),
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 2.5,
        color,
        alpha: 1,
        shape: 'spark'
      });
    }
  }

  public spawnCrashExplosion(x: number, y: number, color = '#ff0055'): void {
    this.spawnRingShatter(x, y, color);
    this.spawnShockwave(x, y, 90, color);
    this.addFloatingText(x, y - 40, 'CRASH!', color, 28);
  }

  public spawnRingShatter(x: number, y: number, color = '#ff003b'): void {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 180 + Math.random() * 380;
      const maxLife = 0.3 + Math.random() * 0.35;
      this.addParticle({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 4 + Math.random() * 5,
        color: Math.random() > 0.4 ? color : '#ffea00',
        alpha: 1,
        shape: 'fragment',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14
      });
    }
  }

  public spawnMeteorFlame(x: number, y: number): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 20;
      const spd = 200 + Math.random() * 300;
      const maxLife = 0.15 + Math.random() * 0.15;
      const colors = ['#ff2200', '#ff7700', '#ffcc00', '#ffffff'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.addParticle({
        x: x + spread,
        y: y - 6,
        vx: (Math.random() - 0.5) * 60,
        vy: -spd,
        life: maxLife,
        maxLife,
        size: 3.5 + Math.random() * 4,
        color,
        alpha: 1,
        shape: 'spark'
      });
    }
  }

  public spawnShockwave(x: number, y: number, maxRadius = 40, color = '#00f0ff'): void {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      life: 0.24,
      maxLife: 0.24,
      color,
      lineWidth: 2.5
    });
  }

  public spawnGemExplosion(x: number, y: number, color: string): void {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spd = 140 + Math.random() * 260;
      const maxLife = 0.35 + Math.random() * 0.25;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.4 ? color : '#ffea00',
        alpha: 1,
        shape: 'square',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12
      });
    }
    this.spawnShockwave(x, y, 50, color);
  }

  public spawnCrash(x: number, y: number): void {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 180 + Math.random() * 420;
      const maxLife = 0.4 + Math.random() * 0.4;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: 3.5 + Math.random() * 5,
        color: Math.random() > 0.5 ? '#ff003b' : '#ffaa00',
        alpha: 1,
        shape: 'spark'
      });
    }
    this.spawnShockwave(x, y, 90, '#ff003b');
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    color = '#00f0ff',
    size = 18
  ): void {
    this.texts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      size,
      life: 0.75,
      maxLife: 0.75,
      vy: -70,
      scale: 1.3
    });
  }

  // Highly optimized render loop without expensive shadowBlur
  public draw(ctx: CanvasRenderingContext2D): void {
    // Shockwaves
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = sw.lineWidth * alpha;
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'spark' || p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square' || p.shape === 'fragment') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // Floating texts
    for (const t of this.texts) {
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${t.size}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
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
