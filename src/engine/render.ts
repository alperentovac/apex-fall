import { Ball, GameState } from '../types';
import { WorldManager, worldToScreen } from './zigzag';
import { ParticleManager } from './particles';

export class GameRenderer {
  private pulsePhase = 0;

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
    this.pulsePhase += 0.05;

    // 1. Deep Midnight Navy Background (#090D18)
    ctx.fillStyle = '#090D18';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Subtle ambient background radiance
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
    ctx.fillStyle = bgGrad;
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

      // Corner platform beacon
      const cornerScreen = worldToScreen({ x: seg.end.x, y: seg.end.y, z: 0 }, camera, viewport);
      const isTargetCorner = isCurrent;
      const beaconColor = pattern === 'RAPID_BURST' ? '#f43f5e' : pattern === 'HIGHWAY' ? '#2dd4bf' : '#00f0ff';

      if (isTargetCorner) {
        const pulseSize = 10 + Math.sin(this.pulsePhase * 2) * 3;
        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = pattern === 'RAPID_BURST' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0, 240, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = beaconColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = beaconColor === '#00f0ff' ? 'rgba(0, 240, 255, 0.45)' : beaconColor;
        ctx.fill();
      }
    }
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
      ctx.arc(screenPos.x, screenPos.y, ballRadius * scale * 0.85, 0, Math.PI * 2);
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

    const outerHalo = ctx.createRadialGradient(
      screenPos.x,
      screenPos.y,
      ball.radius * 0.4,
      screenPos.x,
      screenPos.y,
      ball.radius * 3.5
    );
    outerHalo.addColorStop(0, 'rgba(255, 255, 255, 1)');
    outerHalo.addColorStop(0.25, 'rgba(0, 240, 255, 0.9)');
    outerHalo.addColorStop(0.65, 'rgba(0, 240, 255, 0.3)');
    outerHalo.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, ball.radius * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = outerHalo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, ball.radius, 0, Math.PI * 2);
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
    ctx.fillText(score.toString(), 20, 60);
    ctx.shadowBlur = 0; // reset shadow

    // 2. ORTA: KOMBO (Sadece kombo > 1 iken gösterilir)
    if (combo > 1) {
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Space Grotesk", "Rajdhani", sans-serif';
      ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('COMBO', viewport.width / 2, 26);

      ctx.font = '900 28px "Orbitron", monospace';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = combo >= 50 ? '#00f0ff' : '#ffe600';
      ctx.fillText(`×${combo}`, viewport.width / 2, 58);
    }

    // SAĞ ÜST: Canvas üzerinde skor YOK (Sağ üstte sadece HTML'deki %50 şeffaf neon Home & Mute butonları var)

    // State overlays
    if (state === 'START') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.75)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.textAlign = 'center';
      ctx.font = '900 36px "Orbitron", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowBlur = 16;
      ctx.fillText('ZIGZAG FLOW', viewport.width / 2, viewport.height / 2 - 40);
      ctx.shadowBlur = 0;

      ctx.font = '700 15px "Space Grotesk", "Orbitron", sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('BAŞLAMAK İÇİN DOKUN', viewport.width / 2, viewport.height / 2 + 15);

      ctx.font = '600 13px "Space Grotesk", "Rajdhani", sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.fillText('HER KÖŞEDE DÖNÜŞ +1 PUAN', viewport.width / 2, viewport.height / 2 + 45);
    } else if (state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.82)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

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
}
