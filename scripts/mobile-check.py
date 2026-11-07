"""Browser regression checks. Run against the local Vite server on port 5180."""
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright


def inspect(page):
    return page.evaluate("""() => {
      const g = window.__game;
      g.stop();
      let viewport;
      const draw = g.renderer.draw.bind(g.renderer);
      g.renderer.draw = (...args) => { viewport = args[1]; return draw(...args); };
      g.render();
      let paths = 0;
      const beginPath = g.ctx.beginPath.bind(g.ctx);
      g.ctx.beginPath = () => { paths++; beginPath(); };
      g.state = 'PLAYING';
      g.render();
      const corner = g.world.segments[g.ball.currentSegmentIndex].end;
      const camera = g.juice.getRenderCamera();
      const x = viewport.width / 2 + (corner.x - camera.x - corner.y + camera.y) * Math.cos(Math.PI / 6) * camera.zoom;
      const y = viewport.height / 2 + (corner.x - camera.x + corner.y - camera.y) * 0.5 * camera.zoom;
      const pixel = g.ctx.getImageData(Math.floor(x * g.canvas.width / viewport.width),
        Math.floor(y * g.canvas.height / viewport.height), 1, 1).data;
      const targetVisible = pixel[0] > 240 && pixel[1] > 240 && pixel[2] > 240;
      const pathsPerFrame = paths;
      g.ctx.beginPath = beginPath;
      const rect = g.canvas.getBoundingClientRect();
      const samples = [];
      for (let i = 0; i < 160; i++) {
        const start = performance.now(); g.render(); samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      g.state = 'PLAYING'; g.pauseGame();
      const modal = document.querySelector('.modal-box').getBoundingClientRect();
      return { viewport, canvas: { width: rect.width, height: rect.height },
        pixels: g.canvas.width * g.canvas.height, pathsPerFrame, targetVisible,
        renderMs: { median: samples[80], p95: samples[152] },
        modalFits: modal.top >= 0 && modal.bottom <= innerHeight,
        noOverflow: document.documentElement.scrollWidth <= innerWidth };
    }""")


def check_safe_area(page):
    page.evaluate("""() => {
      const style = document.querySelector('#game-container').style;
      style.setProperty('--safe-top', '44px');
      style.setProperty('--safe-bottom', '34px');
      style.setProperty('--safe-left', '20px');
      style.setProperty('--safe-right', '20px');
    }""")
    page.wait_for_timeout(100)
    bounds = page.evaluate("""() => {
      const canvas = __game.canvas.getBoundingClientRect();
      const controls = document.querySelector('.top-controls').getBoundingClientRect();
      return { top: canvas.top, bottom: canvas.bottom, left: canvas.left,
        controlsTop: controls.top, controlsRight: controls.right };
    }""")
    assert bounds["top"] >= 44 and bounds["bottom"] <= 844 - 34
    assert bounds["left"] >= 20 and bounds["controlsRight"] <= 390 - 20
    assert bounds["controlsTop"] >= 44
    result = inspect(page)
    assert result["viewport"] == result["canvas"], "Safe area resized CSS but not the render viewport"
    page.evaluate("document.querySelector('#game-container').removeAttribute('style')")
    page.wait_for_timeout(100)


def check_play(page):
    page.get_by_role("button", name="DEVAM ET").tap()
    assert page.evaluate("__game.state") == "PLAYING"
    page.get_by_role("button", name="Oyunu duraklat").tap()
    assert page.evaluate("__game.state") == "PAUSED"
    page.evaluate("""() => {
      window.pausedDraws = 0;
      const draw = __game.renderer.draw.bind(__game.renderer);
      __game.renderer.draw = (...args) => { pausedDraws++; return draw(...args); };
    }""")
    page.wait_for_timeout(250)
    assert page.evaluate("pausedDraws") == 0, "Paused game still renders"
    page.get_by_role("button", name="TEKRAR OYNA").tap()
    assert page.evaluate("__game.score === 0 && __game.state === 'PLAYING'")
    page.evaluate("""() => {
      __game.stop();
      const corner = __game.world.segments[0].end;
      __game.ball.x = corner.x; __game.ball.y = corner.y;
    }""")
    page.locator("canvas").tap(position={"x": 150, "y": 250})
    assert page.evaluate("__game.score") == 1, "Touch did not turn the ball"
    page.evaluate("""() => {
      __game.ball.isFalling = true;
      __game.ball.fallTimer = 0.31;
      __game.update(0.016);
      __game.render();
    }""")
    assert page.evaluate("__game.state") == "GAME_OVER"
    page.locator("canvas").tap(position={"x": 150, "y": 250})
    assert page.evaluate("__game.state === 'PLAYING' && __game.score === 0")
    page.evaluate("""() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    assert page.evaluate("__game.state") == "PAUSED", "App switch did not pause"
    page.evaluate("""() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    assert page.evaluate("__game.state") == "PAUSED", "App switch resumed without user input"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    failures = []
    for width, height, dpr in [(320, 568, 2), (390, 844, 3), (844, 390, 3), (667, 320, 2), (768, 1024, 2), (1440, 900, 1)]:
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=dpr,
                                is_mobile=width < 900, has_touch=True)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:5180")
        page.wait_for_load_state("networkidle")
        result = inspect(page)
        name = f"{width}x{height}@{dpr}"
        if any(abs(result["viewport"][key] - result["canvas"][key]) > 1 for key in ["width", "height"]):
            failures.append(f"{name}: render viewport differs from CSS canvas size")
        if not result["modalFits"]:
            failures.append(f"{name}: pause menu extends outside viewport")
        if not result["noOverflow"] or errors:
            failures.append(f"{name}: overflow or browser errors: {errors}")
        if result["pixels"] > 1_000_000:
            failures.append(f"{name}: excessive canvas pixel budget")
        if not result["targetVisible"]:
            failures.append(f"{name}: target corner is hidden by the following platform")
        print(name, json.dumps(result))
        if width in [320, 390, 844]:
            page.screenshot(path=str(Path(tempfile.gettempdir()) / f"apex-fall-{width}-pause.png"))
            page.get_by_role("button", name="TEKRAR OYNA").tap()
            page.evaluate("__game.stop(); __game.render()")
            page.screenshot(path=str(Path(tempfile.gettempdir()) / f"apex-fall-{width}-playing.png"))
            page.evaluate("__game.pauseGame()")
        if width == 390:
            check_safe_area(page)
        check_play(page)
        # Resizing a paused game must update its canvas without restarting it.
        page.set_viewport_size({"width": height, "height": width})
        page.wait_for_timeout(100)
        resized = inspect(page)
        assert abs(resized["viewport"]["width"] - resized["canvas"]["width"]) <= 1
        assert abs(resized["viewport"]["height"] - resized["canvas"]["height"]) <= 1
        assert not errors, errors
        page.close()
    browser.close()
    assert not failures, "\n".join(failures)
    print("OK: responsive browser checks")
