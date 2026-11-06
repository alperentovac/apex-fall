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
  public readonly ringSpacing = 165;
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
    } else if (depth === 1) {
      // Ring 1: Slot 0 is GAP for smooth initial flow, sets streak to 2 so Ring 2 is guaranteed to shift
      sectorTypes[0] = 'GAP';
      this.lastGapSlot = 0;
      this.consecutiveSameGapSlotCount = 2;
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

    // Determine obstacle placement:
    // Warmup depth 0 & 1: 0 obstacles (completely open safe lanes)
    // Early/Mid depth 2..20: Exactly ONE single obstacle block per ring! (leaving 2/3 lanes completely open)
    // High depths 21+: 75% 1 obstacle, 25% 2 obstacles (smooth human-capable scaling)
    const safeIndices: number[] = [];
    for (let i = 0; i < sectorCount; i++) {
      if (sectorTypes[i] === 'SAFE') {
        safeIndices.push(i);
      }
    }

    const obstacleCount = depth <= 1 ? 0 : (depth <= 20 ? 1 : (Math.random() < 0.75 ? 1 : 2));
    let obstacleSector = -1;
    if (obstacleCount === 1 && safeIndices.length > 0) {
      obstacleSector = safeIndices[depth % safeIndices.length];
    }

    const segments: RingSegment[] = [];
    for (let i = 0; i < sectorCount; i++) {
      let hasObstacle = false;
      if (sectorTypes[i] === 'SAFE') {
        if (obstacleCount >= 2) {
          hasObstacle = true;
        } else if (obstacleCount === 1) {
          hasObstacle = (i === obstacleSector);
        }
      }

      segments.push({
        startAngle: i * sectorAngle,
        endAngle: (i + 1) * sectorAngle,
        type: sectorTypes[i],
        hasObstacle
      });
    }

    const theme = COLOR_THEMES[depth % COLOR_THEMES.length];

    return {
      id: this.nextRingId++,
      depth,
      y,
      radius: this.ringRadius,
      thickness: 24,
      rotation: depth <= 2 ? 0 : (depth * 0.16) % (Math.PI * 2),
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
    _playerColorIndex: number = 0,
    playerY?: number,
    worldWidth?: number
  ): void {
    const py = playerY !== undefined ? playerY : cameraY + screenHeight * 0.32;
    const wWidth = worldWidth !== undefined ? worldWidth : this.worldWidth;
    const cx = wWidth / 2;
    const cy = screenHeight * 0.40;
    const R_COLLISION = 175;

    // Filter and sort rings from farthest to nearest (for correct 3D depth layering)
    const activeRings = this.rings.filter((r) => !r.isBroken);
    activeRings.sort((a, b) => b.y - a.y);

    for (const r of activeRings) {
      const dz = r.y - py;
      if (dz < -90 || dz > 850) continue;

      let scale: number;
      let alpha: number;
      if (dz >= 0) {
        scale = 320 / (320 + dz);
        alpha = dz > 600 ? Math.max(0, (850 - dz) / 250) : 1;
      } else {
        scale = 1 + (-dz) / 90;
        alpha = Math.max(0, 1 + dz / 90);
      }

      const ringRadius = R_COLLISION * scale;
      const totalRotation = r.rotation + worldRotation;

      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

      // 1. Concentric Circular Track (Seamless 3-Color Neon Sectors: Cyan, Purple, Amber)
      const trackWidth = Math.max(2, 4 * scale);

      // Cyan Sector Arc (Left: ~80° to ~200°)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = trackWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, Math.PI * 0.45, Math.PI * 1.12);
      ctx.stroke();

      // Purple Sector Arc (Top: ~200° to ~320°)
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
      ctx.lineWidth = trackWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, Math.PI * 1.12, Math.PI * 1.78);
      ctx.stroke();

      // Amber / Gold Sector Arc (Right: ~320° to ~80°)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = trackWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, Math.PI * 1.78, Math.PI * 2.45);
      ctx.stroke();

      // Inner subtle glow hairline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle track grid tick accents along the circumference
      const tickCount = 12;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.max(1, 1.8 * scale);
      for (let t = 0; t < tickCount; t++) {
        const tAngle = (t * Math.PI * 2) / tickCount + totalRotation * 0.3;
        const innerX = cx + Math.cos(tAngle) * (ringRadius - 3 * scale);
        const innerY = cy + Math.sin(tAngle) * (ringRadius - 3 * scale);
        const outerX = cx + Math.cos(tAngle) * (ringRadius + 3 * scale);
        const outerY = cy + Math.sin(tAngle) * (ringRadius + 3 * scale);
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
      }

      // 2. Track Depth Numbers (1, 2, 3 printed along tracks as in 1.png)
      if (scale > 0.32 && scale < 1.15 && r.depth > 0) {
        const numDepth = r.depth % 3;
        const numSize = Math.max(9, Math.round(18 * scale));
        ctx.save();
        ctx.font = `900 ${numSize}px "Orbitron", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (numDepth === 1) {
          // Amber "1" on the right track
          const nAngle = 0.08;
          const nx = cx + Math.cos(nAngle) * (ringRadius + 16 * scale);
          const ny = cy + Math.sin(nAngle) * (ringRadius + 16 * scale);
          ctx.fillStyle = '#f59e0b';
          ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
          ctx.shadowBlur = 8 * scale;
          ctx.fillText('1', nx, ny);
        } else if (numDepth === 2) {
          // Cyan "2" on the left track
          const nAngle = Math.PI - 0.12;
          const nx = cx + Math.cos(nAngle) * (ringRadius + 16 * scale);
          const ny = cy + Math.sin(nAngle) * (ringRadius + 16 * scale);
          ctx.fillStyle = '#00f0ff';
          ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
          ctx.shadowBlur = 8 * scale;
          ctx.fillText('2', nx, ny);
        } else {
          // Purple "3" on the top track
          const nAngle = -Math.PI / 2;
          const nx = cx + Math.cos(nAngle) * (ringRadius + 16 * scale);
          const ny = cy + Math.sin(nAngle) * (ringRadius + 16 * scale);
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = 'rgba(192, 132, 252, 0.8)';
          ctx.shadowBlur = 8 * scale;
          ctx.fillText('3', nx, ny);
        }
        ctx.restore();
      }

      // 3. Golden 3D Obstacle Blocks & Safe Gaps
      for (const seg of r.segments) {
        const segMid = (seg.startAngle + seg.endAngle) / 2;
        const blockAngle = segMid + totalRotation;

        if (seg.type === 'GAP') {
          // Open Safe Portal Gap: Glowing beacons at entry/exit
          const gapStart = seg.startAngle + totalRotation;
          const gapEnd = seg.endAngle + totalRotation;

          ctx.save();
          // Subtle dashed safe portal arc
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
          ctx.lineWidth = Math.max(1.5, 3 * scale);
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, gapStart, gapEnd);
          ctx.stroke();

          // Luminous portal gate beacons
          const b1X = cx + Math.cos(gapStart) * ringRadius;
          const b1Y = cy + Math.sin(gapStart) * ringRadius;
          const b2X = cx + Math.cos(gapEnd) * ringRadius;
          const b2Y = cy + Math.sin(gapEnd) * ringRadius;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b1X, b1Y, Math.max(2, 3.5 * scale), 0, Math.PI * 2);
          ctx.arc(b2X, b2Y, Math.max(2, 3.5 * scale), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(b1X, b1Y, Math.max(1, 2 * scale), 0, Math.PI * 2);
          ctx.arc(b2X, b2Y, Math.max(1, 2 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        // If SAFE sector has no obstacle block, it's an open safe stellar pathway:
        if (seg.hasObstacle === false) {
          continue;
        }

        // 'SAFE' (Golden 3D Obstacle Block - Compact block as in 1.png)
        const halfSpan = 0.26 * Math.min(1.2, scale + 0.3); // ~30° compact width
        const blockThick = Math.max(8, 22 * scale);
        const rOut = ringRadius + blockThick * 0.5;
        const rIn = ringRadius - blockThick * 0.5;
        const a1 = blockAngle - halfSpan;
        const a2 = blockAngle + halfSpan;

        ctx.save();

        // 3D Extrusion Side (towards center to give physical thickness)
        const extrude = Math.max(3, 8 * scale);
        const rInDeep = Math.max(1, rIn - extrude);

        ctx.fillStyle = '#78350f'; // Dark bronze bevel
        ctx.beginPath();
        ctx.arc(cx, cy, rIn, a1, a2);
        ctx.lineTo(cx + Math.cos(a2) * rInDeep, cy + Math.sin(a2) * rInDeep);
        ctx.arc(cx, cy, rInDeep, a2, a1, true);
        ctx.closePath();
        ctx.fill();

        // Metallic Gold Top Face
        const blockMidX = cx + Math.cos(blockAngle) * ringRadius;
        const blockMidY = cy + Math.sin(blockAngle) * ringRadius;
        const goldGrad = ctx.createLinearGradient(
          blockMidX - Math.sin(blockAngle) * 20,
          blockMidY + Math.cos(blockAngle) * 20,
          blockMidX + Math.sin(blockAngle) * 20,
          blockMidY - Math.cos(blockAngle) * 20
        );
        goldGrad.addColorStop(0, '#fef08a'); // Top specular gold shine
        goldGrad.addColorStop(0.45, '#f59e0b'); // Vibrant gold
        goldGrad.addColorStop(1, '#b45309'); // Rich amber gold

        ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
        ctx.shadowBlur = Math.max(4, 12 * scale);
        ctx.fillStyle = goldGrad;

        ctx.beginPath();
        ctx.arc(cx, cy, rOut, a1, a2);
        ctx.lineTo(cx + Math.cos(a2) * rIn, cy + Math.sin(a2) * rIn);
        ctx.arc(cx, cy, rIn, a2, a1, true);
        ctx.closePath();
        ctx.fill();

        // Crisp White-Gold Chamfered Edge Line along Outer Rim
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        ctx.arc(cx, cy, rOut - 0.5, a1 + 0.02, a2 - 0.02);
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }

    // Collectible Gems in 3D Perspective
    for (const g of this.gems) {
      if (g.collected) continue;
      const dz = g.y - py;
      if (dz < -60 || dz > 750) continue;

      let scale: number;
      if (dz >= 0) {
        scale = 320 / (320 + dz);
      } else {
        scale = 1 + (-dz) / 90;
      }

      const ringRadius = R_COLLISION * scale;
      const ring = this.rings.find((r) => r.id === g.ringId);
      const ringRot = ring ? ring.rotation : 0;
      const totalAngle = g.angle + ringRot + worldRotation;

      const gx = cx + Math.cos(totalAngle) * ringRadius;
      const gy = cy + Math.sin(totalAngle) * ringRadius;
      const gemR = Math.max(3, g.radius * scale);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = 'rgba(255, 230, 0, 0.8)';
      ctx.shadowBlur = 8 * scale;

      // Diamond crystal
      ctx.beginPath();
      ctx.moveTo(0, -gemR * 1.2);
      ctx.lineTo(gemR * 0.9, 0);
      ctx.lineTo(0, gemR * 1.2);
      ctx.lineTo(-gemR * 0.9, 0);
      ctx.closePath();
      ctx.fill();

      // Specular shine point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -gemR * 0.3, gemR * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
