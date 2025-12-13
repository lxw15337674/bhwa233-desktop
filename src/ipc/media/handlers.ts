import { os } from "@orpc/server";
import { convertVideoSchema } from "./schemas";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import execa from "execa";
import * as path from "path";
import { ipcContext } from "@/ipc/context";

// Helper to handle ASAR paths
const getBinaryPath = (binaryPath: string | null) => {
  if (!binaryPath) return "";
  return binaryPath.replace("app.asar", "app.asar.unpacked");
};

const FFMPEG_BIN = getBinaryPath(ffmpegPath);
const FFPROBE_BIN = getBinaryPath(ffprobePath?.path || "");

// Helper: Parse HH:MM:SS.ms to seconds
const parseTime = (timeStr: string) => {
  const parts = timeStr.split(":");
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
};

// Helper: Get video duration using ffprobe
const getVideoDuration = async (inputPath: string): Promise<number> => {
  const { stdout } = await execa(FFPROBE_BIN, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  return parseFloat(stdout.trim());
};

export const convertVideo = os
  .input(convertVideoSchema)
  .handler(async ({ input: { inputPath, format } }) => {
    const mainWindow = ipcContext.mainWindow;
    if (!mainWindow) {
      throw new Error("Main window not found");
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const name = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${name}_converted.${format}`);

    // 1. Get Duration
    let totalDuration = 0;
    try {
      totalDuration = await getVideoDuration(inputPath);
    } catch (e) {
      console.warn("Could not determine video duration, progress might be inaccurate", e);
    }

    // 2. Run FFmpeg with execa
    // -y to overwrite output file
    const args = ["-i", inputPath, "-y", outputPath];
    
    const subprocess = execa(FFMPEG_BIN, args);

    // Listen to stderr for progress
    // FFmpeg logs to stderr by default
    subprocess.stderr?.on("data", (data) => {
      const output = data.toString();
      const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);

      if (timeMatch && totalDuration > 0) {
        const currentTime = parseTime(timeMatch[1]);
        const percent = Math.round((currentTime / totalDuration) * 100);
        mainWindow.webContents.send("ffmpeg-progress", Math.min(percent, 99));
      }
    });

    try {
      await subprocess;
      // Success
      mainWindow.webContents.send("ffmpeg-progress", 100);
      return { success: true, outputPath };
    } catch (error: unknown) {
      console.error("Conversion failed:", error);
      throw new Error(`Conversion failed: ${(error as Error).message}`);
    }
  });
