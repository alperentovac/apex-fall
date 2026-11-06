import { Ring, RingSegment, SegmentType, Gem } from '../types';

export const COLOR_THEMES = [
  { color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)' }, // Cyber Cyan
  { color: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)' }, // Neon Rose
  { color: '#39ff14', glow: 'rgba(57, 255, 20, 0.4)' }, // Acid Matrix
  { color: '#ffaa00', glow: 'rgba(255, 170, 0, 0.4)' }, // Solar Flare
  { color: '#b000ff', glow: 'rgba(176, 0, 255, 0.4)' }, // Void Violet
  { color: '#ffe600', glow: 'rgba(255, 230, 0, 0.4)' }, // Electric Gold
  { color: '#00ffcc', glow: 'rgba(0, 255, 204, 0.4)' }  // Hyper Teal
];

export class WorldManager {
  public rings: Ring[] = [];
  public gems: Gem[] = [];
  public highestGeneratedDepth = 0;
  private nextRingId = 1;
  private nextGemId = 1;
  public lastGapSlot = -1;
  public consecutiveSameGapSlotCount = 0;

  public readonly worldWidth = 480;
  public readonly ringSpacing = 150;
  public readonly ringRadius = 135;
  public readonly startY = 220;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.rings = [];
    this.gems = [];
    this.highestGeneratedDepth = -1;
    this.nextRingId = 1;
    this.nextGemId = 1;
    this.lastGapSlot = -1;
    this.consecutiveSameGapSlotCount = 0;

    // Generate initial 30 rings
    this.generateUpToDepth(30);
  }

  public update(dt: number, cameraY: number): void {
    const currentCameraDepth = Math.max(0, Math.floor((cameraY - this.startY) / this.ringSpacing));
    if (currentCameraDepth + 20 > this.highestGeneratedDepth) {
      this.generateUpToDepth(this.highestGeneratedDepth + 20);
    }

    for (const r of this.rings) {
      if (r.rotSpeed !== 0) {
        r.rotation = (r.rotation + r.rotSpeed * dt) % (Math.PI * 2);
        if (r.rotation < 0) r.rotation += Math.PI * 2;
      }
    }

    for (const g of this.gems) {
      g.pulseOffset += dt * 3.5;
    }
  }

  public generateUpToDepth(targetDepth: number): void {
    while (this.highestGeneratedDepth < targetDepth) {
      this.highestGeneratedDepth++;
      const y = this.startY + this.highestGeneratedDepth * this.ringSpacing;
      const ring = this.createRing(this.highestGeneratedDepth, y);
      this.rings.push(ring);
      this.spawnRingGems(ring);
    }
  }

  // Tri-Sector (3 x 120°): Exactly 3 sectors, Zero Red Hazards, Max 2 consecutive identical gap slots
  public createRing(depth: number, y: number): Ring {
    const sectorCount = 3;
    const sectorAngle = (Math.PI * 2) / sectorCount; // Exactly 120 degrees (2*PI/3)
    const sectorTypes: SegmentType[] = ['SAFE', 'SAFE', 'SAFE'];

    if (depth === 0) {
      // Ring 0: 2 GAPs (240° wide opening for smooth drop-in)
      sectorTypes[0] = 'GAP';
      sectorTypes[1] = 'GAP';
      this.lastGapSlot = 0;
      this.consecutiveSameGapSlotCount = 1;
    } else {
      // Anti-Freefall Constraint: Max 2 consecutive rings can have the gap at the exact same slot!
      let chosenSlot: number;
      if (this.consecutiveSameGapSlotCount >= 2) {
        // Guaranteed shift: player must turn!
        const availableSlots = [0, 1, 2].filter((s) => s !== this.lastGapSlot);
        chosenSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        this.lastGapSlot = chosenSlot;
        this.consecutiveSameGapSlotCount = 1;
      } else {
        chosenSlot = Math.floor(Math.random() * 3);
        if (chosenSlot === this.lastGapSlot) {
          this.consecutiveSameGapSlotCount++;
        } else {
          this.lastGapSlot = chosenSlot;
          this.consecutiveSameGapSlotCount = 1;
        }
      }
      sectorTypes[chosenSlot] = 'GAP';
    }

    const segments: RingSegment[] = [];
    for (let i = 0; i < sectorCount; i++) {
      segments.push({
        startAngle: i * sectorAngle,
        endAngle: (i + 1) * sectorAngle,
        type: sectorTypes[i]
      });
    }

    const theme = COLOR_THEMES[depth % COLOR_THEMES.length];

    return {
      id: this.nextRingId++,
      depth,
      y,
      radius: this.ringRadius,
      thickness: 24,
      rotation: 0,
      rotSpeed: 0,
      color: theme.color,
      glow: theme.glow,
      segments,
      passed: false,
      isBroken: false,
      colorIndex: depth % COLOR_THEMES.length
    };
  }

  public getSegmentAtAngle(ring: Ring, angle: number): RingSegment | undefined {
    let relAngle = (angle - ring.rotation) % (Math.PI * 2);
    if (relAngle < 0) relAngle += Math.PI * 2;

    for (const seg of ring.segments) {
      if (relAngle >= seg.startAngle && relAngle < seg.endAngle) {
        return seg;
      }
    }
    return ring.segments[ring.segments.length - 1];
  }

  private spawnRingGems(ring: Ring): void {
    for (const seg of ring.segments) {
      if (seg.type === 'GAP' && Math.random() < 0.6) {
        const midAngle = (seg.startAngle + seg.endAngle) / 2;
        this.gems.push({
          id: this.nextGemId++,
          ringId: ring.id,
          angle: midAngle,
          y: ring.y,
          radius: 8,
          collected: false,
          value: 15 + ring.depth * 5,
          color: '#ffea00',
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    }
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    cameraY: number,
    screenHeight: number,
    worldRotation: number,
    playerColorIndex: number = 0
  ): void {
    const visibleTop = cameraY - 100;
    const visibleBottom = cameraY + screenHeight + 180;
    const centerX = this.worldWidth / 2;

    for (const r of this.rings) {
      if (r.isBroken) continue;
      if (r.y < visibleTop || r.y > visibleBottom) continue;

      ctx.save();
      const ry = r.y;
      const rxRadius = r.radius;
      const ryRadius = r.radius * 0.35;
      const totalRotation = r.rotation + worldRotation;

      const activeTheme = COLOR_THEMES[(r.colorIndex + playerColorIndex) % COLOR_THEMES.length];
      const ringColor = activeTheme.color;

      for (const seg of r.segments) {
        const start = seg.startAngle + totalRotation;
        const end = seg.endAngle + totalRotation;

        if (seg.type === 'GAP') {
          // Open 90-degree portal arc
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
          ctx.stroke();
          ctx.setLineDash([]);

          // Portal gate entry beacons
          const p1X = centerX + Math.cos(start) * rxRadius;
          const p1Y = ry + Math.sin(start) * ryRadius;
          const p2X = centerX + Math.cos(end) * rxRadius;
          const p2Y = ry + Math.sin(end) * ryRadius;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p1X, p1Y, 4.5, 0, Math.PI * 2);
          ctx.arc(p2X, p2Y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = ringColor;
          ctx.beginPath();
          ctx.arc(p1X, p1Y, 2.5, 0, Math.PI * 2);
          ctx.arc(p2X, p2Y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // SAFE Landing Sector
        ctx.lineWidth = r.thickness + 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.03, end - 0.03);
        ctx.stroke();

        ctx.lineWidth = r.thickness;
        ctx.strokeStyle = ringColor;
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.03, end - 0.03);
        ctx.stroke();

        // Inner glowing white accent
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.06, end - 0.06);
        ctx.stroke();
      }

      // Depth tag
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '800 10px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.depth}M`, centerX + rxRadius + 22, ry + 4);

      ctx.restore();
    }

    // Collectible Gems
    for (const g of this.gems) {
      if (g.collected) continue;
      if (g.y < visibleTop || g.y > visibleBottom) continue;

      const ring = this.rings.find((r) => r.id === g.ringId);
      const ringRot = ring ? ring.rotation : 0;
      const totalAngle = g.angle + ringRot + worldRotation;

      const rx = this.ringRadius * 0.95;
      const ry = this.ringRadius * 0.35 * 0.95;
      const gemX = centerX + Math.cos(totalAngle) * rx;
      const gemY = g.y + Math.sin(totalAngle) * ry + Math.sin(g.pulseOffset) * 3;

      ctx.save();
      ctx.translate(gemX, gemY);
      ctx.fillStyle = '#ffe600';

      ctx.beginPath();
      ctx.moveTo(0, -g.radius);
      ctx.lineTo(g.radius * 0.8, 0);
      ctx.lineTo(0, g.radius * 1.1);
      ctx.lineTo(-g.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -g.radius * 0.25, g.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
