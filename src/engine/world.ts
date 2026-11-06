import { Ring, RingSegment, SegmentType, Gem } from '../types';

export class WorldManager {
  public rings: Ring[] = [];
  public gems: Gem[] = [];
  public highestGeneratedDepth = 0;
  private nextRingId = 1;
  private nextGemId = 1;

  public readonly worldWidth = 480;
  public readonly ringSpacing = 160;
  public readonly ringRadius = 140;
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

    // Generate initial 25 rings
    this.generateUpToDepth(25);
  }

  public update(dt: number, cameraY: number): void {
    // Generate rings ahead of camera
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

      // Spawn gems in gap passages or bonus rings
      this.spawnRingGems(ring);
    }
  }

  public createRing(depth: number, y: number): Ring {
    const sliceCount = 12;
    const sliceAngle = (Math.PI * 2) / sliceCount;
    const sliceTypes: SegmentType[] = new Array(sliceCount).fill('SAFE');

    // Ring 0: Tutorial ring with 2 wide gaps and 0 hazards
    if (depth === 0) {
      sliceTypes[0] = 'GAP';
      sliceTypes[1] = 'GAP';
    } else {
      // 1 or 2 Gap slices
      const gapSliceIndex = Math.floor(Math.random() * sliceCount);
      sliceTypes[gapSliceIndex] = 'GAP';
      if (depth < 8 || Math.random() < 0.45) {
        // Wider gap on earlier depths
        sliceTypes[(gapSliceIndex + 1) % sliceCount] = 'GAP';
      }

      // Hazard slices scale with depth
      let hazardCount = 0;
      if (depth >= 3 && depth < 7) {
        hazardCount = 1;
      } else if (depth >= 7 && depth < 15) {
        hazardCount = Math.random() < 0.6 ? 2 : 1;
      } else if (depth >= 15) {
        hazardCount = Math.random() < 0.5 ? 3 : 2;
      }

      // Place hazards away from gap
      let placedHazards = 0;
      let attempts = 0;
      while (placedHazards < hazardCount && attempts < 30) {
        attempts++;
        const candidate = Math.floor(Math.random() * sliceCount);
        // Ensure not in gap or immediately adjacent to gap to keep it fair
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

    // Merge adjacent slices into continuous non-overlapping segments
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
    // Final segment
    segments.push({
      startAngle: curStart * sliceAngle,
      endAngle: Math.PI * 2,
      type: curType
    });

    // Theme color progression based on depth
    let color = '#00f0ff';
    let glow = 'rgba(0, 240, 255, 0.45)';

    if (depth >= 10 && depth < 25) {
      color = '#ff00bb';
      glow = 'rgba(255, 0, 187, 0.45)';
    } else if (depth >= 25 && depth < 45) {
      color = '#ffaa00';
      glow = 'rgba(255, 170, 0, 0.45)';
    } else if (depth >= 45) {
      color = '#00ff88';
      glow = 'rgba(0, 255, 136, 0.45)';
    }

    // Dynamic rotation speed on deeper rings
    let rotSpeed = 0;
    if (depth >= 6 && Math.random() < 0.4) {
      rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.min(depth * 0.03, 1.2));
    }

    return {
      id: this.nextRingId++,
      depth,
      y,
      radius: this.ringRadius,
      thickness: 26,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed,
      color,
      glow,
      segments,
      passed: false,
      isBroken: false
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
    // Find GAP segments and place collectible gems in the gap
    for (const seg of ring.segments) {
      if (seg.type === 'GAP' && Math.random() < 0.6) {
        const midAngle = (seg.startAngle + seg.endAngle) / 2;
        this.gems.push({
          id: this.nextGemId++,
          ringId: ring.id,
          angle: midAngle,
          y: ring.y,
          radius: 9,
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
    worldRotation: number
  ): void {
    const visibleTop = cameraY - 120;
    const visibleBottom = cameraY + screenHeight + 200;
    const centerX = this.worldWidth / 2;

    // Draw rings from bottom to top or top to bottom with 2.5D perspective
    for (const r of this.rings) {
      if (r.isBroken) continue;
      if (r.y < visibleTop || r.y > visibleBottom) continue;

      ctx.save();
      const ry = r.y;
      const rxRadius = r.radius;
      const ryRadius = r.radius * 0.36; // 2.5D elliptical projection ratio

      const totalRotation = r.rotation + worldRotation;

      // Draw each segment of the ring
      for (const seg of r.segments) {
        if (seg.type === 'GAP') continue; // Gaps are empty space

        const isHazard = seg.type === 'HAZARD';
        const start = seg.startAngle + totalRotation;
        const end = seg.endAngle + totalRotation;

        ctx.lineWidth = r.thickness;
        ctx.lineCap = 'round';
        ctx.strokeStyle = isHazard ? '#ff0055' : r.color;
        ctx.shadowBlur = isHazard ? 18 : 12;
        ctx.shadowColor = isHazard ? '#ff0055' : r.glow;

        ctx.beginPath();
        ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start, end);
        ctx.stroke();

        // Inner bright neon accent highlight on safe pads
        if (!isHazard) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ffffff';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rxRadius, ryRadius, 0, start + 0.05, end - 0.05);
          ctx.stroke();
        }
      }

      // Draw ring depth indicator text
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '700 10px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.depth}M`, centerX + rxRadius + 24, ry + 4);

      ctx.restore();
    }

    // Draw collectible gems
    for (const g of this.gems) {
      if (g.collected) continue;
      if (g.y < visibleTop || g.y > visibleBottom) continue;

      const ring = this.rings.find((r) => r.id === g.ringId);
      const ringRot = ring ? ring.rotation : 0;
      const totalAngle = g.angle + ringRot + worldRotation;

      const rx = this.ringRadius * 0.95;
      const ry = this.ringRadius * 0.36 * 0.95;
      const gemX = centerX + Math.cos(totalAngle) * rx;
      const gemY = g.y + Math.sin(totalAngle) * ry + Math.sin(g.pulseOffset) * 4;

      ctx.save();
      ctx.translate(gemX, gemY);
      ctx.shadowBlur = 14;
      ctx.shadowColor = g.color;
      ctx.fillStyle = g.color;

      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -g.radius);
      ctx.lineTo(g.radius * 0.85, 0);
      ctx.lineTo(0, g.radius * 1.15);
      ctx.lineTo(-g.radius * 0.85, 0);
      ctx.closePath();
      ctx.fill();

      // Inner shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -g.radius * 0.3, g.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
