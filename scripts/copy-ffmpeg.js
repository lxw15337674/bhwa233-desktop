const fs = require("fs");
const path = require("path");

const resourcesDir = path.join(__dirname, "..", "resources");

// Ensure resources directory exists
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Get ffmpeg path
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;

// Determine binary names based on platform
const isWindows = process.platform === "win32";
const ffmpegName = isWindows ? "ffmpeg.exe" : "ffmpeg";
const ffprobeName = isWindows ? "ffprobe.exe" : "ffprobe";

// Copy ffmpeg
if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  const dest = path.join(resourcesDir, ffmpegName);
  fs.copyFileSync(ffmpegPath, dest);
  console.log(`Copied ffmpeg to ${dest}`);
} else {
  console.error("ffmpeg-static binary not found!");
  process.exit(1);
}

// Copy ffprobe
if (ffprobePath && fs.existsSync(ffprobePath)) {
  const dest = path.join(resourcesDir, ffprobeName);
  fs.copyFileSync(ffprobePath, dest);
  console.log(`Copied ffprobe to ${dest}`);
} else {
  console.error("ffprobe-static binary not found!");
  process.exit(1);
}

console.log("FFmpeg binaries copied successfully!");
