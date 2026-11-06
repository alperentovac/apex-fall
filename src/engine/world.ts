import { Ring, RingSegment, SegmentType, Gem } from '../types';

export const COLOR_THEMES = [
  { color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)', hazard: '#ff0044' }, // Cyber Cyan
  { color: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)', hazard: '#ffea00' }, // Neon Rose
  { color: '#39ff14', glow: 'rgba(57, 255, 20, 0.4)', hazard: '#ff0055' },  // Acid Matrix
  { color: '#ffaa00', glow: 'rgba(255, 170, 0, 0.4)', hazard: '#ff0044' }, // Solar Flare
  { color: '#b000ff', glow: 'rgba(176, 0, 255, 0.4)', hazard: '#00ffea' }, // Void Violet
  { color: '#ffe600', glow: 'rgba(255, 230, 0, 0.4)', hazard: '#ff0055' }, // Electric Gold
  { color: '#00ffcc', glow: 'rgba(0, 255, 204, 0.4)', hazard: '#ff0066' }  // Hyper Teal
];

export class WorldManager {
  public rings: Ring[] = [];
  public gems: Gem[] = [];
  public highestGeneratedDepth = 0;
  private nextRingId = 1;
  private nextGemId = 1;

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

    // Generate initial 30 rings
    this.generateUpToDepth(30);
  }

  public update(dt: number, cameraY: number): void {
    const currentCameraDepth = Math.max(0, Math.floor((cameraY - this.startY) / this.ringSpacing));
    if (currentCameraDepth + 20 > this.highestGeneratedDepth) {
      this.generateUpToDepth(this.highestGeneratedDepth + 20);
    }

    // Dynamic rotation on very deep rings
    for (const r of this.rings) {
      if (r.rotSpeed !== 0) {
        r.rotation = (r.rotation + r.rotSpeed * dt) % (Math.PI * 2);
        if (r.rotation < 0) r.rotation += Math.PI * 2;
      }
    }

    // Update gems floating animation
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

  // 4 Discrete 90° Quadrants for rhythmic Piano Tiles step mechanics
  public createRing(depth: number, y: number): Ring {
    const quadrantCount = 4;
    const quadrantAngle = (Math.PI * 2) / quadrantCount; // Exactly 90 degrees (PI / 2)
    const quadrantTypes: SegmentType[] = ['SAFE', 'SAFE', 'SAFE', 'SAFE'];

    if (depth === 0) {
      // Ring 0: 3 GAPs (270° wide opening), 1 SAFE
      quadrantTypes[0] = 'GAP';
      quadrantTypes[1] = 'GAP';
      quadrantTypes[2] = 'GAP';
    } else if (depth <= 4) {
      // Early rings (1-4): 2 GAPs (180° opening), 0 Hazards
      const gapIdx = Math.floor(Math.random() * quadrantCount);
      quadrantTypes[gapIdx] = 'GAP';
      quadrantTypes[(gapIdx + 1) % quadrantCount] = 'GAP';
    } else if (depth <= 12) {
      // Mid rings (5-12): 1 GAP, 2 SAFEs, 1 HAZARD
      const gapIdx = Math.floor(Math.random() * quadrantCount);
      quadrantTypes[gapIdx] = 'GAP';

      // Place hazard opposite or adjacent to safe
      const hazardIdx = (gapIdx + 2) % quadrantCount;
      quadrantTypes[hazardIdx] = 'HAZARD';
    } else {
      // Deep rings (13+): 1 GAP, 1 SAFE, 2 HAZARDS
      const gapIdx = Math.floor(Math.random() * quadrantCount);
      quadrantTypes[gapIdx] = 'GAP';
      const hazard1 = (gapIdx + 1) % quadrantCount;
      const hazard2 = (gapIdx + 3) % quadrantCount;
      quadrantTypes[hazard1] = 'HAZARD';
      quadrantTypes[hazard2] = 'HAZARD';
    }

    const segments: RingSegment[] = [];
    for (let i = 0; i < quadrantCount; i++) {
      segments.push({
        startAngle: i * quadrantAngle,
        endAngle: (i + 1) * quadrantAngle,
        type: quadrantTypes[i]
      });
    }

    const theme = COLOR_THEMES[depth % COLOR_THEMES.length];

    // Align base rotation to clean 90° multiples
    const baseQuadrant = Math.floor(Math.random() * 4);
    const rotation = baseQuadrant * quadrantAngle;

    return {
      id: this.nextRingId++,
      depth,
      y,
      radius: this.ringRadius,
      thickness: 24,
      rotation,
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
      const hazardColor = '#ff003b';

      for (const seg of r.segments) {
        const start = seg.startAngle + totalRotation;
        const end = seg.endAngle + totalRotation;

        if (seg.type === 'GAP') {
          // Clear 90-degree portal opening with dotted arc
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
          ctx.stroke();
          ctx.setLineDash([]);

          // Quadrant boundary entry beacons
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

        const isHazard = seg.type === 'HAZARD';

        // Outer glow stroke
        ctx.lineWidth = r.thickness + 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = isHazard ? 'rgba(255, 0, 59, 0.22)' : 'rgba(0, 240, 255, 0.18)';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.03, end - 0.03);
        ctx.stroke();

        // Main segment body
        ctx.lineWidth = r.thickness;
        ctx.strokeStyle = isHazard ? hazardColor : ringColor;
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.03, end - 0.03);
        ctx.stroke();

        // Inner highlight
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = isHazard ? '#ff99aa' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.06, end - 0.06);
        ctx.stroke();

        // Hazard indicator
        if (isHazard) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          const mid = (start + end) / 2;
          const hx = centerX + Math.cos(mid) * rxRadius;
          const hy = ry + Math.sin(mid) * ryRadius;
          ctx.beginPath();
          ctx.arc(hx, hy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
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
