import { Ball, GameState } from '../types';
import { WorldManager, worldToScreen } from './zigzag';
import { ParticleManager } from './particles';

export class GameRenderer {
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
    // 1. Deep Midnight Navy Background (#090D18)
    ctx.fillStyle = '#090D18';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Subtle background ambient glow at center
    const bgGrad = ctx.createRadialGradient(
      viewport.width / 2,
      viewport.height / 2,
      20,
      viewport.width / 2,
      viewport.height / 2,
      viewport.height * 0.7
    );
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
    bgGrad.addColorStop(1, 'rgba(9, 13, 24, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // 2. 2.5D Isometric Path with 3D Extruded Blocks
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
    const endIdx = Math.min(world.segments.length, ball.currentSegmentIndex + 18);
    const blockDepth = 18; // 3D extrusion thickness

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
        t0 = worldToScreen({ x: seg.start.x, y: seg.start.y - halfW, z: 0 }, camera, viewport);
        t1 = worldToScreen({ x: seg.end.x, y: seg.end.y - halfW, z: 0 }, camera, viewport);
        t2 = worldToScreen({ x: seg.end.x, y: seg.end.y + halfW, z: 0 }, camera, viewport);
        t3 = worldToScreen({ x: seg.start.x, y: seg.start.y + halfW, z: 0 }, camera, viewport);

        b1 = worldToScreen({ x: seg.end.x, y: seg.end.y - halfW, z: -blockDepth }, camera, viewport);
        b2 = worldToScreen({ x: seg.end.x, y: seg.end.y + halfW, z: -blockDepth }, camera, viewport);
        b3 = worldToScreen({ x: seg.start.x, y: seg.start.y + halfW, z: -blockDepth }, camera, viewport);
      } else {
        t0 = worldToScreen({ x: seg.start.x - halfW, y: seg.start.y, z: 0 }, camera, viewport);
        t1 = worldToScreen({ x: seg.end.x - halfW, y: seg.end.y, z: 0 }, camera, viewport);
        t2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y, z: 0 }, camera, viewport);
        t3 = worldToScreen({ x: seg.start.x + halfW, y: seg.start.y, z: 0 }, camera, viewport);

        b1 = worldToScreen({ x: seg.end.x - halfW, y: seg.end.y, z: -blockDepth }, camera, viewport);
        b2 = worldToScreen({ x: seg.end.x + halfW, y: seg.end.y, z: -blockDepth }, camera, viewport);
        b3 = worldToScreen({ x: seg.start.x + halfW, y: seg.start.y, z: -blockDepth }, camera, viewport);
      }

      // Draw extruded right side face
      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.lineTo(b3.x, b3.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fillStyle = '#0d1322';
      ctx.fill();

      // Draw extruded left/front side face
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.closePath();
      ctx.fillStyle = '#101728';
      ctx.fill();

      // Draw top walking surface
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();

      const isCurrent = i === ball.currentSegmentIndex;
      ctx.fillStyle = isCurrent ? '#1e293b' : '#141d2f';
      ctx.fill();

      // Glowing geometric border
      ctx.strokeStyle = isCurrent ? '#00f0ff55' : 'rgba(0, 240, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing target corner apex diamond
      const cornerScreen = worldToScreen({ x: seg.end.x, y: seg.end.y, z: 0 }, camera, viewport);
      const isTargetCorner = isCurrent;

      ctx.beginPath();
      ctx.arc(cornerScreen.x, cornerScreen.y, isTargetCorner ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isTargetCorner ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)';
      ctx.fill();

      if (isTargetCorner) {
        ctx.beginPath();
        ctx.arc(cornerScreen.x, cornerScreen.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
      const scale = 1 - (i / trail.length) * 0.6;

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ballRadius * scale * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.38})`;
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

    // Multi-layer outer glow halo
    const outerHalo = ctx.createRadialGradient(
      screenPos.x,
      screenPos.y,
      ball.radius * 0.5,
      screenPos.x,
      screenPos.y,
      ball.radius * 3.2
    );
    outerHalo.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    outerHalo.addColorStop(0.3, 'rgba(0, 240, 255, 0.85)');
    outerHalo.addColorStop(0.7, 'rgba(0, 240, 255, 0.25)');
    outerHalo.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, ball.radius * 3.2, 0, Math.PI * 2);
    ctx.fillStyle = outerHalo;
    ctx.fill();

    // Solid bright core
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, ball.radius * 0.85, 0, Math.PI * 2);
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

    // 1. Top-Left: Score
    ctx.textAlign = 'left';
    ctx.font = '800 11px "Orbitron", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SCORE', 20, 26);

    ctx.font = '900 24px "Orbitron", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score.toString(), 20, 52);

    // 2. Top-Center: Perfect Combo
    if (combo > 0) {
      ctx.textAlign = 'center';
      ctx.font = '800 11px "Orbitron", monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('PERFECT COMBO', viewport.width / 2, 26);

      ctx.font = '900 26px "Orbitron", monospace';
      ctx.fillStyle = combo >= 50 ? '#00f0ff' : '#ffe600';
      ctx.fillText(`×${combo}`, viewport.width / 2, 53);
    }

    // 3. Top-Right: Best Score & Best Combo
    ctx.textAlign = 'right';
    ctx.font = '800 11px "Orbitron", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BEST', viewport.width - 20, 26);

    ctx.font = '900 22px "Orbitron", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${bestScore} (×${bestCombo})`, viewport.width - 20, 52);

    // State overlays
    if (state === 'START') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.7)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.textAlign = 'center';
      ctx.font = '900 32px "Orbitron", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('ZIGZAG FLOW', viewport.width / 2, viewport.height / 2 - 32);

      ctx.font = '700 13px "Orbitron", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('TAP OR PRESS SPACE TO START', viewport.width / 2, viewport.height / 2 + 16);

      ctx.font = '600 12px "Rajdhani", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('TURN AT THE CORNERS • BUILD THE COMBO', viewport.width / 2, viewport.height / 2 + 42);
    } else if (state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(9, 13, 24, 0.82)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.textAlign = 'center';
      ctx.font = '900 28px "Orbitron", monospace';
      ctx.fillStyle = '#ff0055';
      ctx.fillText('FALL DETECTED', viewport.width / 2, viewport.height / 2 - 45);

      ctx.font = '800 16px "Orbitron", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SCORE ${score}  |  BEST ${bestScore}`, viewport.width / 2, viewport.height / 2);

      ctx.font = '700 13px "Orbitron", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('TAP TO RESTART INSTANTLY', viewport.width / 2, viewport.height / 2 + 48);
    }

    ctx.restore();
  }
}
