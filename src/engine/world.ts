import { Platform, Gem, PlatformType } from '../types';

export class WorldManager {
  public platforms: Platform[] = [];
  public gems: Gem[] = [];
  private highestGeneratedFloor = 0;
  private nextPlatformId = 1;
  private nextGemId = 1;
  public readonly worldWidth = 480;
  public readonly groundY = 820;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.platforms = [];
    this.gems = [];
    this.highestGeneratedFloor = 0;
    this.nextPlatformId = 1;
    this.nextGemId = 1;

    // Floor 0: Ground Platform
    this.platforms.push({
      id: this.nextPlatformId++,
      x: 0,
      y: this.groundY,
      width: this.worldWidth,
      height: 60,
      type: 'SOLID',
      floor: 0,
      color: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.5)'
    });

    // Generate first 30 floors
    this.generateUpToFloor(30);
  }

  public update(dt: number, cameraY: number): void {
    // Generate more platforms ahead of camera
    const currentTopFloor = Math.floor(Math.abs(cameraY - this.groundY) / 100);
    if (currentTopFloor + 25 > this.highestGeneratedFloor) {
      this.generateUpToFloor(this.highestGeneratedFloor + 25);
    }

    // Update moving and crumbling platforms
    for (const p of this.platforms) {
      if (p.type === 'MOVING' && p.vx !== undefined && p.minX !== undefined && p.maxX !== undefined) {
        p.x += p.vx * dt;
        if (p.x <= p.minX) {
          p.x = p.minX;
          p.vx = Math.abs(p.vx);
        } else if (p.x + p.width >= p.maxX) {
          p.x = p.maxX - p.width;
          p.vx = -Math.abs(p.vx);
        }
      }

      if (p.isCrumbling && p.crumbleTimer !== undefined) {
        p.crumbleTimer -= dt;
        if (p.crumbleTimer <= 0) {
          p.isBroken = true;
        }
      }
    }

    // Update gems floating animation
    for (const g of this.gems) {
      g.pulseOffset += dt * 3.5;
    }
  }

  public generateUpToFloor(targetFloor: number): void {
    while (this.highestGeneratedFloor < targetFloor) {
      this.highestGeneratedFloor++;
      this.spawnFloorPlatform(this.highestGeneratedFloor);
    }
  }

  private spawnFloorPlatform(floor: number): void {
    // Height calculation: ~90-120px between floors
    const floorSpacing = 95 + Math.min(floor * 0.4, 25);
    const y = this.groundY - floor * floorSpacing;

    // Width scales with difficulty
    const baseWidth = Math.max(75, 140 - Math.min(floor * 1.5, 60));
    
    // Choose platform type based on floor tier
    let type: PlatformType = 'SOLID';
    const rand = Math.random();

    if (floor > 5 && rand < 0.28) {
      type = 'MOVING';
    } else if (floor > 8 && rand < 0.52) {
      type = 'BOUNCY';
    } else if (floor > 12 && rand < 0.76) {
      type = 'CRUMBLING';
    }

    // Platform position (zig-zag / varied)
    const margin = 35;
    const availableWidth = this.worldWidth - baseWidth - margin * 2;
    // Prefer alternation between left/right/center to encourage dynamic jumps
    const x = margin + Math.random() * availableWidth;

    let color = '#00f0ff';
    let glow = 'rgba(0, 240, 255, 0.45)';

    if (type === 'BOUNCY') {
      color = '#ff00aa';
      glow = 'rgba(255, 0, 170, 0.6)';
    } else if (type === 'CRUMBLING') {
      color = '#ffbb00';
      glow = 'rgba(255, 187, 0, 0.5)';
    } else if (type === 'MOVING') {
      color = '#00ff88';
      glow = 'rgba(0, 255, 136, 0.5)';
    }

    const platform: Platform = {
      id: this.nextPlatformId++,
      x,
      y,
      width: baseWidth,
      height: 14,
      type,
      floor,
      color,
      glow,
      isBroken: false
    };

    if (type === 'MOVING') {
      const speed = 70 + Math.min(floor * 2.5, 90);
      platform.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
      platform.minX = margin;
      platform.maxX = this.worldWidth - margin;
    }

    this.platforms.push(platform);

    // Chance to spawn a high-dopamine Gem above the platform
    if (Math.random() < 0.75) {
      this.gems.push({
        id: this.nextGemId++,
        x: x + baseWidth / 2,
        y: y - 24,
        radius: 8,
        collected: false,
        value: 10 + floor * 5,
        color: type === 'BOUNCY' ? '#ff00aa' : '#00ffcc',
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    // Occasional risky bonus gem in mid-air gap
    if (Math.random() < 0.35 && floor > 3) {
      const midAirX = (x > this.worldWidth / 2) ? x - 80 : x + baseWidth + 40;
      if (midAirX > 40 && midAirX < this.worldWidth - 40) {
        this.gems.push({
          id: this.nextGemId++,
          x: midAirX,
          y: y + floorSpacing * 0.45,
          radius: 11,
          collected: false,
          value: 50 + floor * 15,
          color: '#ffea00',
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, cameraY: number, screenHeight: number): void {
    const visibleTop = cameraY - 150;
    const visibleBottom = cameraY + screenHeight + 150;

    // Draw platforms
    for (const p of this.platforms) {
      if (p.isBroken) continue;
      if (p.y < visibleTop || p.y > visibleBottom) continue;

      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.glow;

      // Platform body
      ctx.fillStyle = p.color;
      if (p.type === 'CRUMBLING' && p.isCrumbling && p.crumbleTimer !== undefined) {
        // Shake / flash crumbling platform
        const shake = (Math.random() - 0.5) * 4;
        ctx.translate(shake, 0);
        ctx.globalAlpha = 0.5 + 0.5 * (p.crumbleTimer / 0.8);
      }

      ctx.beginPath();
      // Round top corners
      const r = 5;
      ctx.roundRect(p.x, p.y, p.width, p.height, [r, r, 2, 2]);
      ctx.fill();

      // Top glowing highlight strip
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(p.x + 3, p.y + 1, p.width - 6, 2.5);

      // Floor tag indicator
      if (p.floor > 0) {
        ctx.globalAlpha = 0.45;
        ctx.font = '700 9px "Orbitron", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`F${p.floor}`, p.x + p.width / 2, p.y + p.height + 10);
      }

      ctx.restore();
    }

    // Draw gems
    for (const g of this.gems) {
      if (g.collected) continue;
      if (g.y < visibleTop || g.y > visibleBottom) continue;

      const floatY = g.y + Math.sin(g.pulseOffset) * 4;
      ctx.save();
      ctx.translate(g.x, floatY);

      // Gem outer glow
      ctx.shadowBlur = 14;
      ctx.shadowColor = g.color;

      // Diamond shape
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.moveTo(0, -g.radius);
      ctx.lineTo(g.radius * 0.9, 0);
      ctx.lineTo(0, g.radius * 1.2);
      ctx.lineTo(-g.radius * 0.9, 0);
      ctx.closePath();
      ctx.fill();

      // Inner sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -g.radius * 0.3, g.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
