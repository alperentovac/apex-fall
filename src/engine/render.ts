import { Ball, GameState } from '../types';
import { WorldManager, worldToScreen } from './zigzag';
import { ParticleManager } from './particles';

export class GameRenderer {
  private pulsePhase = 0;
  private background?: {
    ctx: CanvasRenderingContext2D; width: number; height: number;
    pixelWidth: number; gradient: CanvasGradient;
  };

  public update(dt: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 3) % (Math.PI * 2);
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    viewport: { width: number; height: number },
    camera: { x: number; y: number; zoom: number },
    world: WorldManager,
    ball: Ball,
    trail: Array<{ x: number; y: number; z: number; alpha: number }>,
    particles: ParticleManager,
    state: GameState,
    score: number,
    combo: number,
    bestScore: number,
    _bestCombo: number
  ): void {
    // 1. Deep Midnight Navy Background (#090D18)
    ctx.fillStyle = '#090D18';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Subtle ambient background radiance
    if (!this.background || this.background.ctx !== ctx ||
        this.background.width !== viewport.width || this.background.height !== viewport.height ||
        this.background.pixelWidth !== ctx.canvas.width) {
      const bgGrad = ctx.createRadialGradient(
        viewport.width / 2,
        viewport.height * 0.45,
        30,
        viewport.width / 2,
        viewport.height * 0.45,
        viewport.height * 0.75
      );
      bgGrad.addColorStop(0, 'rgba(16, 29, 58, 0.45)');
      bgGrad.addColorStop(1, 'rgba(9, 13, 24, 0)');
      this.background = { ctx, ...viewport, pixelWidth: ctx.canvas.width, gradient: bgGrad };
    }
    ctx.fillStyle = this.background.gradient;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // 2. 2.5D Isometric Path with 3D Extruded Blocks & Vivid Contrast
    this.drawPath(ctx, viewport, camera, world, ball);

    // 3. Neon Ball Trail
    this.drawTrail(ctx, viewport, camera, trail, ball.radius);

    // 4. Particle Sparks
    particles.draw(ctx, camera, viewport);

    // 5. Glowing Ball Orb
    this.drawBall(ctx, viewport, camera, ball);

    // 6. Minimalist HUD & State Overlay (Score en solda tek)
    this.drawHUD(ctx, viewport, state, score, combo, bestScore);
  }

  private drawPath(
    ctx: CanvasRenderingContext2D,
    viewport: { width: number; height: number },
    camera: { x: number; y: number; zoom: number },
    world: WorldManager,
    ball: Ball
  ): void {
    const startIdx = Math.max(0, ball.currentSegmentIndex - 3);
    const endIdx = Math.min(world.segments.length, ball.currentSegmentIndex + 22);
    const blockDepth = 22;

    for (let i = startIdx; i < endIdx; i++) {
      const seg = world.segments[i];
      const halfW = seg.tileWidth / 2;

      // Top face vertices (z = 0)
      let t0: { x: number; y: number };
      let t1: { x: number; y: number };
      let t2: { x: number; y: number };
      let t3: { x: number; y: number };

      // Bottom extruded vertices (z = -blockDepth)
      let b1: { x: number; y: number };
      let b2: { x: number; y: number };
      let b3: { x: number; y: number };

      if (seg.dir === 'X') {
        t0 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y - halfW, z: 0 }, camera, viewport);
        t1 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y - halfW, z: 0 }, camera, viewport);
        t2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y + halfW, z: 0 }, camera, viewport);
        t3 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y + halfW, z: 0 }, camera, viewport);

        b1 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y - halfW, z: -blockDepth }, camera, viewport);
        b2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y + halfW, z: -blockDepth }, camera, viewport);
        b3 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y + halfW, z: -blockDepth }, camera, viewport);
      } else {
        t0 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y - halfW, z: 0 }, camera, viewport);
        t1 = worldToScreen({ x: seg.end.x - halfW, y: seg.end.y + halfW, z: 0 }, camera, viewport);
        t2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y + halfW, z: 0 }, camera, viewport);
        t3 = worldToScreen({ x: seg.start.x + halfW, y: seg.start.y - halfW, z: 0 }, camera, viewport);

        b1 = worldToScreen({ x: seg.end.x - halfW, y: seg.end.y + halfW, z: -blockDepth }, camera, viewport);
        b2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y + halfW, z: -blockDepth }, camera, viewport);
        b3 = worldToScreen({ x: seg.start.x + halfW, y: seg.start.y - halfW, z: -blockDepth }, camera, viewport);
      }

      // Reject offscreen blocks before issuing any canvas paths or fills.
      if (Math.max(t0.x, t1.x, t2.x, t3.x) < -16 ||
          Math.min(t0.x, t1.x, t2.x, t3.x) > viewport.width + 16 ||
          Math.max(b1.y, b2.y, b3.y) < -16 ||
          Math.min(t0.y, t1.y, t2.y, t3.y) > viewport.height + 16) continue;

      const isCurrent = i === ball.currentSegmentIndex;
      const pattern = seg.patternType || 'STANDARD';

      // 3D Extruded right side face
      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.lineTo(b3.x, b3.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fillStyle = pattern === 'RAPID_BURST' ? '#1f0d22' : pattern === 'HIGHWAY' ? '#0b1d28' : '#0e1628';
      ctx.fill();

      // 3D Extruded left/front side face
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.closePath();
      ctx.fillStyle = pattern === 'RAPID_BURST' ? '#2f1334' : pattern === 'HIGHWAY' ? '#102938' : '#141e34';
      ctx.fill();

      // Top walking surface
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();

      if (pattern === 'RAPID_BURST') {
        ctx.fillStyle = isCurrent ? '#4e1d52' : '#331238';
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#ff2a6d' : 'rgba(255, 42, 109, 0.7)';
      } else if (pattern === 'HIGHWAY') {
        ctx.fillStyle = isCurrent ? '#163847' : '#102633';
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#2dd4bf' : 'rgba(45, 212, 191, 0.5)';
      } else {
        ctx.fillStyle = isCurrent ? '#243b60' : '#1a2740';
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)';
      }

      ctx.lineWidth = isCurrent ? 2.2 : 1.5;
      ctx.stroke();

      if (isCurrent) continue;
      // Corner platform beacon
      const cornerScreen = worldToScreen({ x: seg.end.x, y: seg.end.y, z: 0 }, camera, viewport);
      const beaconColor = pattern === 'RAPID_BURST' ? '#f43f5e' : pattern === 'HIGHWAY' ? '#2dd4bf' : '#00f0ff';

      ctx.beginPath();
      ctx.arc(cornerScreen.x, cornerScreen.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = beaconColor === '#00f0ff' ? 'rgba(0, 240, 255, 0.45)' : beaconColor;
      ctx.fill();
    }

    // Paint the active target after all blocks so the next platform cannot hide it.
    const target = world.segments[ball.currentSegmentIndex];
    if (!target) return;
    const corner = worldToScreen(target.end, camera, viewport);
    if (corner.x < -16 || corner.x > viewport.width + 16 || corner.y < -16 || corner.y > viewport.height + 16) return;
    const pattern = target.patternType;
    const pulseSize = 10 + Math.sin(this.pulsePhase * 2) * 3;
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = pattern === 'RAPID_BURST' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0, 240, 255, 0.2)';
    ctx.fill();
    ctx.strokeStyle = pattern === 'RAPID_BURST' ? '#f43f5e' : pattern === 'HIGHWAY' ? '#2dd4bf' : '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  private drawTrail(
    ctx: CanvasRenderingContext2D,
    viewport: { width: number; height: number },
    camera: { x: number; y: number; zoom: number },
    trail: Array<{ x: number; y: number; z: number; alpha: number }>,
    ballRadius: number
  ): void {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      if (t.alpha <= 0.03) continue;

      const screenPos = worldToScreen({ x: t.x, y: t.y, z: t.z }, camera, viewport);
      const scale = 1 - (i / trail.length) * 0.5;

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ballRadius * camera.zoom * scale * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.45})`;
      ctx.fill();
    }
  }

  private drawBall(
    ctx: CanvasRenderingContext2D,
    viewport: { width: number; height: number },
    camera: { x: number; y: number; zoom: number },
    ball: Ball
  ): void {
    const screenPos = worldToScreen(ball, camera, viewport);
    const radius = ball.radius * camera.zoom;

    const outerHalo = ctx.createRadialGradient(
      screenPos.x,
      screenPos.y,
      radius * 0.4,
      screenPos.x,
      screenPos.y,
      radius * 3.5
    );
    outerHalo.addColorStop(0, 'rgba(255, 255, 255, 1)');
    outerHalo.addColorStop(0.25, 'rgba(0, 240, 255, 0.9)');
    outerHalo.addColorStop(0.65, 'rgba(0, 240, 255, 0.3)');
    outerHalo.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = outerHalo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  private drawHUD(
    ctx: CanvasRenderingContext2D,
    viewport: { width: number; height: number },
    state: GameState,
    score: number,
    combo: number,
    bestScore: number
  ): void {
    ctx.save();

    // Top HUD Bar background container
    ctx.fillStyle = 'rgba(9, 13, 24, 0.65)';
    ctx.fillRect(0, 0, viewport.width, 74);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 74);
    ctx.lineTo(viewport.width, 74);
    ctx.stroke();

    // 1. SOLDA TEK SCORE: Kullanıcı talebi (2 yerde score olmasın, en solda tek olsun)
    ctx.textAlign = 'left';
    ctx.font = '700 12px "Space Grotesk", "Rajdhani", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.fillText('SCORE', 20, 26);

    ctx.font = '900 34px "Orbitron", "Space Grotesk", monospace';
    ctx.letterSpacing = '1px';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(score.toString(), 20, 60, Math.max(64, viewport.width / 2 - 56));
    ctx.shadowBlur = 0; // reset shadow

    // 2. ORTA: KOMBO (Sadece kombo > 1 iken gösterilir)
    if (combo > 1) {
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Space Grotesk", "Rajdhani", sans-serif';
      ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#f59e0b';
      const comboX = viewport.width / 2 - 8;
      const comboWidth = Math.max(46, viewport.width - 260);
      ctx.fillText('COMBO', comboX, 26, comboWidth);

      ctx.font = '900 28px "Orbitron", monospace';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = combo >= 50 ? '#00f0ff' : '#ffe600';
      ctx.fillText(`×${combo}`, comboX, 58, comboWidth);
    }

    // SAĞ ÜST: Canvas üzerinde skor YOK (Sağ üstte sadece HTML'deki %50 şeffaf neon Home & Mute butonları var)

    // State overlays
    if (state === 'START') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.8)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      this.fitOverlay(ctx, viewport);

      const logoY = viewport.height / 2 - 80;
      this.drawLogo(ctx, viewport.width / 2, logoY, 68);

      ctx.textAlign = 'center';
      ctx.font = '900 36px "Orbitron", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowBlur = 18;
      ctx.fillText('APEX FALL', viewport.width / 2, logoY + 70);
      ctx.shadowBlur = 0;

      const pulseAlpha = 0.75 + Math.sin(this.pulsePhase * 3) * 0.25;
      ctx.font = '700 15px "Space Grotesk", "Orbitron", sans-serif';
      ctx.letterSpacing = '1.2px';
      ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
      ctx.fillText('BAŞLAMAK İÇİN DOKUN', viewport.width / 2, logoY + 115);

      ctx.font = '600 13px "Space Grotesk", "Rajdhani", sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.fillText('HER KÖŞEDE DÖNÜŞ +1 PUAN', viewport.width / 2, logoY + 145);
    } else if (state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.82)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      this.fitOverlay(ctx, viewport);

      // DÜŞÜŞ ALGILANDI KALDIRILDI!
      ctx.textAlign = 'center';

      // SKOR
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.fillText('SKOR', viewport.width / 2, viewport.height / 2 - 65);

      ctx.font = '900 48px "Orbitron", monospace';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      ctx.shadowBlur = 18;
      ctx.fillText(score.toString(), viewport.width / 2, viewport.height / 2 - 15);
      ctx.shadowBlur = 0;

      // EN İYİ SKOR
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`EN İYİ: ${bestScore}`, viewport.width / 2, viewport.height / 2 + 25);

      // YENİDEN BAŞLAMAK İÇİN DOKUN
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText('YENİDEN BAŞLAMAK İÇİN DOKUN', viewport.width / 2, viewport.height / 2 + 65);

      // %50 Şeffaf Neon Replay Butonu/İkonu
      const iconY = viewport.height / 2 + 115;
      const radius = 26;

      ctx.beginPath();
      ctx.arc(viewport.width / 2, iconY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Replay dairesel ok çizimi (%50 şeffaf neon)
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(viewport.width / 2, iconY, 13, -Math.PI * 0.8, Math.PI * 0.65);
      ctx.stroke();

      // Ok ucu
      const arrowTipX = viewport.width / 2 + Math.cos(Math.PI * 0.65) * 13;
      const arrowTipY = iconY + Math.sin(Math.PI * 0.65) * 13;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(arrowTipX - 4, arrowTipY - 6);
      ctx.lineTo(arrowTipX + 3, arrowTipY);
      ctx.lineTo(arrowTipX - 5, arrowTipY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private fitOverlay(ctx: CanvasRenderingContext2D, viewport: { width: number; height: number }): void {
    const scale = Math.min(1, (viewport.width - 32) / 360, (viewport.height - 100) / 310);
    ctx.translate(viewport.width / 2 * (1 - scale), viewport.height / 2 * (1 - scale));
    ctx.scale(scale, scale);
  }

  private drawLogo(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number
  ): void {
    const s = size / 2;
    const pulse = Math.sin(this.pulsePhase * 2) * 1.5;

    // Ambient radial glow behind the emblem
    const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, s * 1.6);
    glow.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
    glow.addColorStop(0.5, 'rgba(255, 42, 109, 0.15)');
    glow.addColorStop(1, 'rgba(9, 13, 24, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // 1. Right Fall Face (Crimson / Magenta gradient)
    const rightGrad = ctx.createLinearGradient(cx, cy - s, cx + s * 0.9, cy + s * 0.7);
    rightGrad.addColorStop(0, '#ff2a6d');
    rightGrad.addColorStop(1, '#881337');

    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.85, cy + s * 0.35);
    ctx.lineTo(cx + s * 0.85, cy + s * 0.75);
    ctx.lineTo(cx, cy + s * 0.4);
    ctx.closePath();
    ctx.fillStyle = rightGrad;
    ctx.fill();
    ctx.strokeStyle = '#ff2a6d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Left Climb Face (Cyan / Sky gradient)
    const leftGrad = ctx.createLinearGradient(cx - s * 0.9, cy + s * 0.7, cx, cy - s);
    leftGrad.addColorStop(0, '#0284c7');
    leftGrad.addColorStop(1, '#00f0ff');

    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s * 0.85, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.85, cy + s * 0.75);
    ctx.lineTo(cx, cy + s * 0.4);
    ctx.closePath();
    ctx.fillStyle = leftGrad;
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Top Summit Facet (Glassy diamond apex)
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.6);
    ctx.lineTo(cx, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.45, cy - s * 0.6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Central Chevron Cutouts (Apex Zigzag Lines)
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s * 0.15);
    ctx.lineTo(cx, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.15);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.45);
    ctx.lineTo(cx, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.45);
    ctx.strokeStyle = '#ff2a6d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 5. Summit Glowing Orb
    const orbGlow = ctx.createRadialGradient(cx, cy - s, 1, cx, cy - s, 9 + pulse);
    orbGlow.addColorStop(0, '#ffffff');
    orbGlow.addColorStop(0.4, 'rgba(0, 240, 255, 0.9)');
    orbGlow.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.beginPath();
    ctx.arc(cx, cy - s, 9 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = orbGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy - s, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}
