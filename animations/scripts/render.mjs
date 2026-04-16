/**
 * Headless rendering script for Motion Canvas animations.
 *
 * Usage:
 *   node scripts/render.mjs                    # render all scenes
 *   node scripts/render.mjs replay-flow        # render one scene
 *   node scripts/render.mjs --force            # skip mtime check
 *
 * Requires the dev server to NOT be running (this script starts its own).
 */

import { chromium } from "playwright";
import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCENES_DIR = join(ROOT, "src", "scenes");
const OUTPUT_DIR = join(ROOT, "output");
const PORT = 9000;
const BASE_URL = `http://localhost:${PORT}`;

// ── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes("--force");
const sceneFilter = args.find((a) => !a.startsWith("--"));

// ── Find scenes ─────────────────────────────────────────────
async function discoverScenes() {
  const entries = await readdir(SCENES_DIR, { withFileTypes: true });
  const scenes = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (sceneFilter) {
    const match = scenes.find((s) => s === sceneFilter);
    if (!match) {
      console.error(`Scene "${sceneFilter}" not found. Available: ${scenes.join(", ")}`);
      process.exit(1);
    }
    return [match];
  }
  return scenes;
}

// ── Check if scene needs re-render ──────────────────────────
async function needsRender(sceneName) {
  if (force) return true;
  const sceneDir = join(SCENES_DIR, sceneName);
  const outputFile = join(OUTPUT_DIR, "project", `${sceneName}.mp4`);
  try {
    const outputStat = await stat(outputFile);
    const sceneEntries = await readdir(sceneDir);
    for (const entry of sceneEntries) {
      if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        const srcStat = await stat(join(sceneDir, entry));
        if (srcStat.mtimeMs > outputStat.mtimeMs) return true;
      }
    }
    // Also check theme
    const themeStat = await stat(join(ROOT, "src", "styles", "theme.ts"));
    if (themeStat.mtimeMs > outputStat.mtimeMs) return true;
    return false;
  } catch {
    return true; // output doesn't exist
  }
}

// ── Start dev server ────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      join(ROOT, "node_modules", ".bin", "vite"),
      ["--port", String(PORT), "--strictPort"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    );
    let started = false;

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      if (!started && text.includes("ready")) {
        started = true;
        resolve(proc);
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      // Vite CJS warning is harmless
      if (!text.includes("CJS build")) {
        process.stderr.write(data);
      }
    });

    proc.on("error", reject);

    setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Dev server failed to start within 15s"));
      }
    }, 15000);
  });
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const scenes = await discoverScenes();
  const toRender = [];
  for (const scene of scenes) {
    if (await needsRender(scene)) {
      toRender.push(scene);
    } else {
      console.log(`⏭  ${scene} (unchanged)`);
    }
  }

  if (toRender.length === 0) {
    console.log("Nothing to render.");
    return;
  }

  console.log(`\nRendering ${toRender.length} scene(s): ${toRender.join(", ")}\n`);

  // Start dev server
  console.log("Starting dev server...");
  const server = await startServer();
  console.log(`Dev server ready on port ${PORT}\n`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to Motion Canvas editor
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Wait for the app to fully initialize
    await page.waitForTimeout(2000);

    // Use the Motion Canvas internal API to trigger rendering.
    // The project and renderer are available on the window after the app loads.
    for (const sceneName of toRender) {
      console.log(`🎬 Rendering ${sceneName}...`);

      const result = await page.evaluate(async (name) => {
        // Motion Canvas exposes the project on the global scope
        // We need to find the renderer and trigger it
        const app = window.__MOTION_CANVAS_RUNTIME__;
        if (!app) {
          return { error: "Motion Canvas runtime not found on window" };
        }

        try {
          // Try to render via the renderer
          const renderer = app.renderer;
          if (renderer && typeof renderer.render === "function") {
            await renderer.render({
              name,
            });
            return { success: true };
          }
          return { error: "Renderer not available" };
        } catch (e) {
          return { error: e.message };
        }
      }, sceneName);

      if (result.error) {
        console.log(`   ⚠  API rendering not available (${result.error})`);
        console.log(`   Falling back to UI automation...`);

        // Fallback: click the render button in the UI
        try {
          // Click the RENDER button
          const renderButton = page.locator('button:has-text("RENDER"), button:has-text("Render")');
          if (await renderButton.isVisible({ timeout: 3000 })) {
            await renderButton.click();

            // Wait for rendering to complete (watch for the button to become clickable again)
            // Rendering state changes are reflected in the UI
            await page.waitForFunction(() => {
              const btn = document.querySelector('button');
              return btn && !btn.disabled;
            }, { timeout: 300000 }); // 5 min timeout

            console.log(`   ✓ ${sceneName} rendered`);
          } else {
            console.log(`   ✕ Render button not found`);
          }
        } catch (e) {
          console.log(`   ✕ UI automation failed: ${e.message}`);
        }
      } else {
        console.log(`   ✓ ${sceneName} rendered`);
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    console.log("\nDone.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
