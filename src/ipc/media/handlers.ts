import { os } from "@orpc/server";
import { convertVideoSchema, getVideoInfoSchema, VideoInfo } from "./schemas";
import { app } from "electron";
import execa from "execa";
import * as path from "path";
import * as fs from "fs";
import { ipcContext } from "@/ipc/context";

// Get binary paths from resources directory
const getBinaryPath = (binaryName: string): string => {
  const isWindows = process.platform === "win32";
  const ext = isWindows ? ".exe" : "";
  const fileName = `${binaryName}${ext}`;

  if (app.isPackaged) {
    // Production: use process.resourcesPath
    return path.join(process.resourcesPath, fileName);
  } else {
    // Development: use project root/resources
    return path.join(process.cwd(), "resources", fileName);
  }
};

const FFMPEG_BIN = getBinaryPath("ffmpeg");
const FFPROBE_BIN = getBinaryPath("ffprobe");

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

// Get detailed video info using ffprobe
export const getVideoInfo = os
  .input(getVideoInfoSchema)
  .handler(async ({ input: { inputPath } }): Promise<VideoInfo> => {
    const { stdout } = await execa(FFPROBE_BIN, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name,r_frame_rate,bit_rate:format=duration,size,format_name,bit_rate",
      "-of",
      "json",
      inputPath,
    ]);

    const probeData = JSON.parse(stdout);
    const stream = probeData.streams?.[0] || {};
    const format = probeData.format || {};

    // Parse frame rate (e.g., "30/1" or "30000/1001")
    let fps = 0;
    if (stream.r_frame_rate) {
      const [num, den] = stream.r_frame_rate.split("/").map(Number);
      fps = den ? Math.round((num / den) * 100) / 100 : num;
    }

    // Get file size
    let size = 0;
    try {
      const stats = fs.statSync(inputPath);
      size = stats.size;
    } catch {
      size = parseInt(format.size) || 0;
    }

    return {
      duration: parseFloat(format.duration) || 0,
      width: stream.width || 0,
      height: stream.height || 0,
      codec: stream.codec_name || "unknown",
      bitrate: parseInt(stream.bit_rate || format.bit_rate) || 0,
      fps,
      size,
      format: format.format_name?.split(",")[0] || path.extname(inputPath).slice(1),
    };
  });

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
