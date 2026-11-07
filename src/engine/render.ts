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
    bestCombo: number
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

    // 6. Minimalist HUD & State Overlay
    this.drawHUD(ctx, viewport, state, score, combo, bestScore, bestCombo);
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
    const blockDepth = 22; // 3D extrusion thickness

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

      // 3D Extruded right side face
      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.lineTo(b3.x, b3.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fillStyle = '#0e1628';
      ctx.fill();

      // 3D Extruded left/front side face
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.closePath();
      ctx.fillStyle = '#141e34';
      ctx.fill();

      // Top walking surface with high contrast
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();

      const isCurrent = i === ball.currentSegmentIndex;
      ctx.fillStyle = isCurrent ? '#243b60' : '#1a2740';
      ctx.fill();

      // Vibrant geometric edge lines
      ctx.strokeStyle = isCurrent ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = isCurrent ? 2 : 1.5;
      ctx.stroke();

      // Corner platform beacon
      const cornerScreen = worldToScreen({ x: seg.end.x, y: seg.end.y, z: 0 }, camera, viewport);
      const isTargetCorner = isCurrent;

      if (isTargetCorner) {
        // Concentric animated beacon on the active turn target
        const pulseSize = 10 + Math.sin(this.pulsePhase * 2) * 3;
        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
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

    // Multi-stage outer glow aura
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

    // Solid core
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
    bestScore: number,
    bestCombo: number
  ): void {
    ctx.save();

    // Top HUD Bar background container for high readability
    ctx.fillStyle = 'rgba(9, 13, 24, 0.7)';
    ctx.fillRect(0, 0, viewport.width, 68);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 68);
    ctx.lineTo(viewport.width, 68);
    ctx.stroke();

    // 1. Top-Left: Score
    ctx.textAlign = 'left';
    ctx.font = '800 11px "Orbitron", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SCORE', 20, 25);

    ctx.font = '900 24px "Orbitron", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score.toString(), 20, 52);

    // 2. Top-Center: Perfect Combo
    if (combo > 0) {
      ctx.textAlign = 'center';
      ctx.font = '800 11px "Orbitron", monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('PERFECT COMBO', viewport.width / 2, 25);

      ctx.font = '900 26px "Orbitron", monospace';
      ctx.fillStyle = combo >= 50 ? '#00f0ff' : '#ffe600';
      ctx.fillText(`×${combo}`, viewport.width / 2, 53);
    }

    // 3. Top-Right: Best Score & Best Combo
    ctx.textAlign = 'right';
    ctx.font = '800 11px "Orbitron", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BEST', viewport.width - 20, 25);

    ctx.font = '900 22px "Orbitron", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${bestScore} (×${bestCombo})`, viewport.width - 20, 52);

    // State overlays
    if (state === 'START') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.72)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.textAlign = 'center';
      ctx.font = '900 32px "Orbitron", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('ZIGZAG FLOW', viewport.width / 2, viewport.height / 2 - 34);

      ctx.font = '700 14px "Orbitron", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('DOKUN VEYA BOŞLUK TUŞUNA BAS', viewport.width / 2, viewport.height / 2 + 16);

      ctx.font = '600 13px "Rajdhani", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('KÖŞELERDE DÖN • AKIŞI YAKALA', viewport.width / 2, viewport.height / 2 + 42);
    } else if (state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.82)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.textAlign = 'center';
      ctx.font = '900 28px "Orbitron", monospace';
      ctx.fillStyle = '#ff0055';
      ctx.fillText('DÜŞÜŞ ALGILANDI', viewport.width / 2, viewport.height / 2 - 45);

      ctx.font = '800 16px "Orbitron", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SKOR ${score}  |  EN İYİ ${bestScore}`, viewport.width / 2, viewport.height / 2);

      ctx.font = '700 13px "Orbitron", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('YENİDEN BAŞLAMAK İÇİN DOKUN', viewport.width / 2, viewport.height / 2 + 48);
    }

    ctx.restore();
  }
}
