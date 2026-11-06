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
  public readonly ringSpacing = 155;
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

    // Generate initial rings
    this.generateUpToDepth(30);
  }

  public update(dt: number, cameraY: number): void {
    const currentCameraDepth = Math.max(0, Math.floor((cameraY - this.startY) / this.ringSpacing));
    if (currentCameraDepth + 20 > this.highestGeneratedDepth) {
      this.generateUpToDepth(this.highestGeneratedDepth + 20);
    }

    // Auto-rotate dynamic rings
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

  public createRing(depth: number, y: number): Ring {
    const sliceCount = 12;
    const sliceAngle = (Math.PI * 2) / sliceCount;
    const sliceTypes: SegmentType[] = new Array(sliceCount).fill('SAFE');

    // Ring 0: Wide start gaps and 0 hazards
    if (depth === 0) {
      sliceTypes[0] = 'GAP';
      sliceTypes[1] = 'GAP';
    } else {
      // 1 or 2 Gap slices
      const gapSliceIndex = Math.floor(Math.random() * sliceCount);
      sliceTypes[gapSliceIndex] = 'GAP';
      if (depth < 6 || Math.random() < 0.4) {
        sliceTypes[(gapSliceIndex + 1) % sliceCount] = 'GAP';
      }

      // Hazards scale with depth
      let hazardCount = 0;
      if (depth >= 3 && depth < 8) {
        hazardCount = 1;
      } else if (depth >= 8 && depth < 16) {
        hazardCount = Math.random() < 0.6 ? 2 : 1;
      } else if (depth >= 16) {
        hazardCount = Math.random() < 0.5 ? 3 : 2;
      }

      let placedHazards = 0;
      let attempts = 0;
      while (placedHazards < hazardCount && attempts < 30) {
        attempts++;
        const candidate = Math.floor(Math.random() * sliceCount);
        const isNearGap =
          sliceTypes[candidate] === 'GAP' ||
          sliceTypes[(candidate + 1) % sliceCount] === 'GAP' ||
          sliceTypes[(candidate + sliceCount - 1) % sliceCount] === 'GAP';

        if (!isNearGap && sliceTypes[candidate] === 'SAFE') {
          sliceTypes[candidate] = 'HAZARD';
          placedHazards++;
        }
      }
    }

    // Merge adjacent slices
    const segments: RingSegment[] = [];
    let curType = sliceTypes[0];
    let curStart = 0;

    for (let i = 1; i < sliceCount; i++) {
      if (sliceTypes[i] !== curType) {
        segments.push({
          startAngle: curStart * sliceAngle,
          endAngle: i * sliceAngle,
          type: curType
        });
        curType = sliceTypes[i];
        curStart = i;
      }
    }
    segments.push({
      startAngle: curStart * sliceAngle,
      endAngle: Math.PI * 2,
      type: curType
    });

    const theme = COLOR_THEMES[depth % COLOR_THEMES.length];

    // Auto rotation on deeper rings
    let rotSpeed = 0;
    if (depth >= 5 && Math.random() < 0.35) {
      rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.min(depth * 0.025, 0.9));
    }

    return {
      id: this.nextRingId++,
      depth,
      y,
      radius: this.ringRadius,
      thickness: 24,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed,
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
      if (seg.type === 'GAP' && Math.random() < 0.55) {
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

  // High performance 2.5D renderer without expensive shadowBlur
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

      // Dynamic theme color shifting based on player's current passage color
      const activeTheme = COLOR_THEMES[(r.colorIndex + playerColorIndex) % COLOR_THEMES.length];
      const ringColor = activeTheme.color;
      const hazardColor = '#ff003b';

      for (const seg of r.segments) {
        const start = seg.startAngle + totalRotation;
        const end = seg.endAngle + totalRotation;

        if (seg.type === 'GAP') {
          // Visual Portal Gate indicators at gap boundaries for extreme readability!
          // Draw bright dotted guide arc in the gap
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
          ctx.stroke();
          ctx.setLineDash([]);

          // Glowing gate edge beacons (circles) at gap entries
          const p1X = centerX + Math.cos(start) * rxRadius;
          const p1Y = ry + Math.sin(start) * ryRadius;
          const p2X = centerX + Math.cos(end) * rxRadius;
          const p2Y = ry + Math.sin(end) * ryRadius;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p1X, p1Y, 5, 0, Math.PI * 2);
          ctx.arc(p2X, p2Y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = ringColor;
          ctx.beginPath();
          ctx.arc(p1X, p1Y, 3, 0, Math.PI * 2);
          ctx.arc(p2X, p2Y, 3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const isHazard = seg.type === 'HAZARD';

        // Outer glow stroke (replaces expensive shadowBlur on mobile!)
        ctx.lineWidth = r.thickness + 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = isHazard ? 'rgba(255, 0, 59, 0.25)' : 'rgba(0, 240, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
        ctx.stroke();

        // Main segment body
        ctx.lineWidth = r.thickness;
        ctx.strokeStyle = isHazard ? hazardColor : ringColor;
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
        ctx.stroke();

        // Inner bright accent strip
        ctx.lineWidth = 4;
        ctx.strokeStyle = isHazard ? '#ff99aa' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.04, end - 0.04);
        ctx.stroke();

        // Hazard warning tick marks
        if (isHazard) {
          ctx.lineWidth = 2.5;
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
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

      // Gem center shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -g.radius * 0.25, g.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
