import { defineConfig } from "vite";
import mc from "@motion-canvas/vite-plugin";
import ffmpegModule from "@motion-canvas/ffmpeg";

const motionCanvas = typeof mc === "function" ? mc : (mc as any).default;
const ffmpeg = typeof ffmpegModule === "function" ? ffmpegModule : (ffmpegModule as any).default;

export default defineConfig({
  plugins: [
    motionCanvas({
      project: ["./src/project.ts"],
    }),
    ffmpeg(),
  ],
});
