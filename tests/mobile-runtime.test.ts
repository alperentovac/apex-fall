import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/main';
import { SoundManager } from '../src/engine/audio';
import { worldToScreen } from '../src/engine/world';

function setupBrowser() {
  const win = Object.assign(new EventTarget(), {
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3
  });
  const doc = Object.assign(new EventTarget(), {
    hidden: false, getElementById: () => null
  });
  const canvas = Object.assign(new EventTarget(), {
    width: 300, height: 150, clientWidth: 390, clientHeight: 844,
    parentElement: null,
    getContext: () => context
  });
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy({ canvas }, {
    get: (target, key) => key in target ? target[key as keyof typeof target]
      : key === 'measureText' ? (text: string) => ({ width: text.length * 10 })
      : String(key).startsWith('create') ? () => gradient : vi.fn()
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const game = new Game(canvas as unknown as HTMLCanvasElement);
  return { game, win, doc };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mobile runtime regressions', () => {
  it('renders in CSS pixels on DPR 3 screens with a bounded pixel buffer', () => {
    const { game } = setupBrowser();
    const draw = vi.spyOn(game.renderer, 'draw').mockImplementation(() => {});
    game.render();
    expect(draw.mock.calls[0][1]).toEqual({ width: 390, height: 844 });
    expect(game.canvas.width * game.canvas.height).toBeLessThanOrEqual(1_000_000);
  });

  it('keeps the first target corner visible on a narrow phone', () => {
    const { game } = setupBrowser();
    const corner = worldToScreen(game.world.segments[0].end, game.juice.getRenderCamera(),
      { width: 390, height: 844 });
    expect(corner.x).toBeLessThanOrEqual(390 - 13);
    expect(corner.x).toBeGreaterThanOrEqual(13);
    expect(corner.y).toBeGreaterThan(74);
  });

  it('does not schedule duplicate loops and stops rendering when paused', () => {
    const { game } = setupBrowser();
    vi.spyOn(game, 'render').mockImplementation(() => {});
    game.state = 'PLAYING';
    game.start();
    game.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    game.pauseGame();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    game.resumeGame();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('pauses on app switching and waits for explicit resume', () => {
    const { game, doc } = setupBrowser();
    game.state = 'PLAYING';
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(game.state).toBe('PAUSED');
    const x = game.ball.x;
    game.update(0.05);
    expect(game.ball.x).toBe(x);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(game.state).toBe('PAUSED');
  });

  it('ignores held keys, secondary pointers and taps during a fall', () => {
    const { game, win } = setupBrowser();
    game.state = 'PLAYING';
    const input = vi.spyOn(game, 'handleInput');
    const key = Object.assign(new Event('keydown'), { code: 'Space', repeat: true });
    win.dispatchEvent(key);
    const pointer = Object.assign(new Event('pointerdown'), { isPrimary: false, button: 0 });
    game.canvas.dispatchEvent(pointer);
    expect(input).not.toHaveBeenCalled();
    game.ball.isFalling = true;
    game.ball.x = game.world.segments[0].end.x;
    expect(game.handleInput()).toBeNull();
    expect(game.score).toBe(0);
    expect(game.ball.currentSegmentIndex).toBe(0);
  });

  it('freezes effects along with physics in the pause menu', () => {
    const { game } = setupBrowser();
    game.particles.spawnCornerSparks(game.ball, 1);
    const life = game.particles.particles[0].life;
    game.state = 'PAUSED';
    game.update(0.05);
    expect(game.particles.particles[0].life).toBe(life);
  });

  it('rejects corrupted saved scores and keeps session records when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'NaN', setItem: () => { throw new Error('Storage blocked'); }
    });
    const { game } = setupBrowser();
    expect(game.bestScore).toBe(0);
    game.score = 12;
    game.combo = 5;
    game.saveBestScores();
    expect(game.bestScore).toBe(12);
    expect(game.bestCombo).toBe(5);
  });

  it('restarts a completed fall with a single tap', () => {
    const { game } = setupBrowser();
    game.state = 'GAME_OVER';
    game.ball.isFalling = true;
    game.score = 10;
    game.handleInput();
    expect(game.state).toBe('PLAYING');
    expect(game.ball.isFalling).toBe(false);
    expect(game.score).toBe(0);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('unmuting in the pause menu does not restart background music', () => {
    setupBrowser();
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    vi.stubGlobal('Audio', class {
      paused = true;
      play = play;
      pause = pause;
    });
    const audio = new SoundManager();
    audio.playMusic();
    expect(play).toHaveBeenCalledTimes(1);
    audio.pauseMusic();
    audio.toggleMute();
    audio.toggleMute();
    expect(play).toHaveBeenCalledTimes(1);
    audio.playMusic();
    expect(play).toHaveBeenCalledTimes(2);
  });
});
