import { os } from "@orpc/server";
import {
  convertVideoSchema,
  getVideoInfoSchema,
  VideoInfo,
  batchConvertSchema,
  batchControlSchema,
  BatchProgress,
  BatchOverallProgress,
  HardwareInfo,
  GpuAccelType,
  ConversionMode,
} from "./schemas";
import { app, dialog, Notification } from "electron";
import execa, { ExecaChildProcess } from "execa";
import * as path from "path";
import * as fs from "fs";
import * as nodeos from "os";
import { ipcContext } from "@/ipc/context";

// Get binary paths from resources directory
const getBinaryPath = (binaryName: string): string => {
  const isWindows = process.platform === "win32";
  const ext = isWindows ? ".exe" : "";
  const fileName = `${binaryName}${ext}`;

  if (app.isPackaged) {
    return path.join(process.resourcesPath, fileName);
  } else {
    return path.join(process.cwd(), "resources", fileName);
  }
};

const FFMPEG_BIN = getBinaryPath("ffmpeg");
const FFPROBE_BIN = getBinaryPath("ffprobe");

// Hardware detection cache
let cachedHardwareInfo: HardwareInfo | null = null;

// Test if a specific encoder actually works
const testEncoder = async (encoder: string): Promise<boolean> => {
  try {
    // Run a quick test: encode 1 frame from a null source
    await execa(
      FFMPEG_BIN,
      [
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=256x256:d=0.1",
        "-c:v",
        encoder,
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ],
      { timeout: 10000 },
    );
    return true;
  } catch {
    return false;
  }
};

// Test if a hardware decoder works
const testHwDecoder = async (hwaccel: string): Promise<boolean> => {
  try {
    await execa(
      FFMPEG_BIN,
      [
        "-hwaccel",
        hwaccel,
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=256x256:d=0.1",
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ],
      { timeout: 10000 },
    );
    return true;
  } catch {
    return false;
  }
};

// Detect available GPU encoders by actually testing them
const detectGpuAcceleration = async (): Promise<{
  type: GpuAccelType;
  name: string;
  hwDecoder: string;
  hevcSupport: boolean;
}> => {
  // Test encoders in priority order
  const encoders: {
    encoder: string;
    hevcEncoder: string;
    type: GpuAccelType;
    name: string;
    decoder: string;
  }[] = [
    {
      encoder: "h264_nvenc",
      hevcEncoder: "hevc_nvenc",
      type: "nvenc",
      name: "NVIDIA NVENC",
      decoder: "cuda",
    },
    {
      encoder: "h264_qsv",
      hevcEncoder: "hevc_qsv",
      type: "qsv",
      name: "Intel Quick Sync",
      decoder: "qsv",
    },
    {
      encoder: "h264_amf",
      hevcEncoder: "hevc_amf",
      type: "amf",
      name: "AMD AMF",
      decoder: "d3d11va",
    },
  ];

  for (const { encoder, hevcEncoder, type, name, decoder } of encoders) {
    console.log(`Testing encoder: ${encoder}...`);
    if (await testEncoder(encoder)) {
      console.log(`Encoder ${encoder} is available`);
      // Test corresponding decoder
      const decoderWorks = await testHwDecoder(decoder);
      console.log(`Decoder ${decoder} available: ${decoderWorks}`);
      // Test HEVC encoder
      const hevcWorks = await testEncoder(hevcEncoder);
      console.log(`HEVC encoder ${hevcEncoder} available: ${hevcWorks}`);
      return {
        type,
        name,
        hwDecoder: decoderWorks ? decoder : "none",
        hevcSupport: hevcWorks,
      };
    }
    console.log(`Encoder ${encoder} not available`);
  }

  // Try d3d11va decoder even without GPU encoder (Windows generic)
  if (process.platform === "win32") {
    const d3d11Works = await testHwDecoder("d3d11va");
    if (d3d11Works) {
      return {
        type: "none",
        name: "Software Encoding",
        hwDecoder: "d3d11va",
        hevcSupport: true,
      };
    }
  }

  return {
    type: "none",
    name: "Software Encoding",
    hwDecoder: "none",
    hevcSupport: true,
  };
};

// Internal function to get hardware info (used by handlers)
const fetchHardwareInfo = async (): Promise<HardwareInfo> => {
  if (cachedHardwareInfo) {
    return cachedHardwareInfo;
  }

  const cpuThreads = nodeos.cpus().length;
  const gpuInfo = await detectGpuAcceleration();

  cachedHardwareInfo = {
    gpuAccel: gpuInfo.type,
    gpuName: gpuInfo.name,
    cpuThreads,
    hwDecoder: gpuInfo.hwDecoder,
    hevcSupport: gpuInfo.hevcSupport,
  };

  return cachedHardwareInfo;
};

// Get hardware info - exposed via IPC
export const getHardwareInfo = os.handler(async (): Promise<HardwareInfo> => {
  return fetchHardwareInfo();
});

// Select output folder dialog
export const selectFolder = os.handler(async (): Promise<string | null> => {
  const mainWindow = ipcContext.mainWindow;
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Output Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Apply filename template
const applyFilenameTemplate = (
  template: string,
  originalName: string,
  format: string,
): string => {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS

  return template
    .replace(/{name}/g, originalName)
    .replace(/{date}/g, date)
    .replace(/{time}/g, time)
    .replace(/{format}/g, format);
};

// Send system notification
const sendNotification = (title: string, body: string) => {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.show();
  }
};

// Get encoder arguments based on format, GPU, and conversion mode
const getEncoderArgs = (
  format: string,
  gpuAccel: GpuAccelType,
  conversionMode: ConversionMode,
  threads: number,
  hevcSupport: boolean,
): string[] => {
  const args: string[] = [];

  // Thread count
  args.push("-threads", threads.toString());

  // Determine encoding parameters based on mode
  let useHevc = false;
  let crf = 23;
  let preset = "medium";

  if (conversionMode === "highQuality") {
    // High Quality: HEVC (if supported) + CRF 23 + slower preset for best compression/quality ratio
    useHevc = hevcSupport;
    crf = 23;
    preset = "slower";
  } else if (conversionMode === "fast") {
    // Fast: H.264 + CRF 28 + fast preset for quick processing with acceptable quality loss
    useHevc = false;
    crf = 28;
    preset = "fast";
  } else {
    // Original mode: Should not reach here (handled by stream copy), but fallback to high quality
    useHevc = hevcSupport;
    crf = 18;
    preset = "medium";
  }

  // Video formats with H.264 or HEVC
  if (["mp4", "mov", "mkv", "avi", "flv"].includes(format)) {
    if (useHevc) {
      // HEVC/H.265 encoding
      if (gpuAccel === "nvenc") {
        args.push(
          "-c:v",
          "hevc_nvenc",
          "-preset",
          preset === "slower" ? "p7" : preset === "fast" ? "p1" : "p4",
          "-cq",
          crf.toString(),
        );
      } else if (gpuAccel === "qsv") {
        args.push(
          "-c:v",
          "hevc_qsv",
          "-preset",
          preset === "slower" ? "veryslow" : preset === "fast" ? "veryfast" : "medium",
          "-global_quality",
          crf.toString(),
        );
      } else if (gpuAccel === "amf") {
        args.push(
          "-c:v",
          "hevc_amf",
          "-quality",
          preset === "slower" ? "quality" : preset === "fast" ? "speed" : "balanced",
          "-qp_i",
          crf.toString(),
          "-qp_p",
          crf.toString(),
        );
      } else {
        // Software HEVC
        args.push(
          "-c:v",
          "libx265",
          "-preset",
          preset,
          "-crf",
          crf.toString(),
        );
      }
    } else {
      // H.264 encoding
      if (gpuAccel === "nvenc") {
        args.push(
          "-c:v",
          "h264_nvenc",
          "-preset",
          preset === "slower" ? "p7" : preset === "fast" ? "p1" : "p4",
          "-cq",
          crf.toString(),
        );
      } else if (gpuAccel === "qsv") {
        args.push(
          "-c:v",
          "h264_qsv",
          "-preset",
          preset === "slower" ? "veryslow" : preset === "fast" ? "veryfast" : "medium",
          "-global_quality",
          crf.toString(),
        );
      } else if (gpuAccel === "amf") {
        args.push(
          "-c:v",
          "h264_amf",
          "-quality",
          preset === "slower" ? "quality" : preset === "fast" ? "speed" : "balanced",
          "-qp_i",
          crf.toString(),
          "-qp_p",
          crf.toString(),
        );
      } else {
        // Software H.264
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          preset,
          "-crf",
          crf.toString(),
        );
      }
    }
    args.push("-c:a", "aac");
  }
  // WebM (VP9 - no GPU acceleration widely available)
  else if (format === "webm") {
    args.push("-c:v", "libvpx-vp9", "-crf", crf.toString(), "-b:v", "0");
    args.push(
      "-cpu-used",
      preset === "fast" ? "4" : preset === "slower" ? "1" : "2",
    );
    args.push("-c:a", "libopus");
  }
  // WMV
  else if (format === "wmv") {
    args.push("-c:v", "wmv2", "-c:a", "wmav2");
  }
  // GIF
  else if (format === "gif") {
    args.push("-vf", "fps=15,scale=480:-1:flags=lanczos");
  }
  // Audio only
  else if (format === "mp3") {
    const mp3Quality = preset === "fast" ? "4" : preset === "slower" ? "0" : "2";
    args.push("-vn", "-c:a", "libmp3lame", "-q:a", mp3Quality);
  } else if (format === "wav") {
    args.push("-vn", "-c:a", "pcm_s16le");
  }

  return args;
};

// Get hardware decoding arguments
const getHwDecoderArgs = (hwDecoder: string): string[] => {
  if (hwDecoder === "none") return [];
  return ["-hwaccel", hwDecoder];
};

// Check if stream copy is possible (codec compatible with target format)
const canUseStreamCopy = (
  sourceVideoCodec: string,
  sourceAudioCodec: string,
  targetFormat: string,
): { video: boolean; audio: boolean } => {
  // Video codec compatibility with containers
  const videoCompatibility: Record<string, string[]> = {
    h264: ["mp4", "mkv", "mov", "avi", "flv", "ts"],
    hevc: ["mp4", "mkv", "mov", "ts"],
    vp9: ["webm", "mkv"],
    vp8: ["webm", "mkv"],
    mpeg4: ["mp4", "mkv", "avi"],
  };

  // Audio codec compatibility with containers
  const audioCompatibility: Record<string, string[]> = {
    aac: ["mp4", "mkv", "mov", "flv", "ts"],
    mp3: ["mp4", "mkv", "mov", "avi", "ts"],
    ac3: ["mp4", "mkv", "mov", "avi", "ts"],
    eac3: ["mp4", "mkv", "mov", "ts"],
    opus: ["webm", "mkv", "ogg"],
    vorbis: ["webm", "mkv", "ogg"],
    flac: ["mkv", "ogg"],
    pcm_s16le: ["wav", "avi", "mkv"],
    pcm_s24le: ["wav", "avi", "mkv"],
  };

  const videoOk =
    videoCompatibility[sourceVideoCodec]?.includes(targetFormat) || false;
  const audioOk =
    audioCompatibility[sourceAudioCodec]?.includes(targetFormat) || false;

  return { video: videoOk, audio: audioOk };
};

// Get video codec info for smart copy detection
const getVideoCodec = async (
  inputPath: string,
): Promise<{ videoCodec: string; audioCodec: string }> => {
  try {
    const { stdout } = await execa(FFPROBE_BIN, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const videoCodec = stdout.trim().toLowerCase();

    const { stdout: audioOut } = await execa(FFPROBE_BIN, [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const audioCodec = audioOut.trim().toLowerCase();

    return { videoCodec, audioCodec };
  } catch {
    return { videoCodec: "unknown", audioCodec: "unknown" };
  }
};

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
      format:
        format.format_name?.split(",")[0] || path.extname(inputPath).slice(1),
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

    // Get hardware info for optimization
    const hwInfo = await fetchHardwareInfo();
    const encoderArgs = getEncoderArgs(
      format,
      hwInfo.gpuAccel,
      "highQuality", // Default to high quality mode
      hwInfo.cpuThreads,
      hwInfo.hevcSupport,
    );

    // 1. Get Duration
    let totalDuration = 0;
    try {
      totalDuration = await getVideoDuration(inputPath);
    } catch (e) {
      console.warn(
        "Could not determine video duration, progress might be inaccurate",
        e,
      );
    }

    // 2. Run FFmpeg with execa
    const args = ["-i", inputPath, ...encoderArgs, "-y", outputPath];

    const subprocess = execa(FFMPEG_BIN, args);

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
      mainWindow.webContents.send("ffmpeg-progress", 100);
      return { success: true, outputPath };
    } catch (error: unknown) {
      console.error("Conversion failed:", error);
      throw new Error(`Conversion failed: ${(error as Error).message}`);
    }
  });

// Batch conversion state
let batchState: {
  isPaused: boolean;
  isCancelled: boolean;
  currentProcesses: Map<number, ExecaChildProcess>;
  files: string[];
  format: string;
  outputDir?: string;
  conversionMode: ConversionMode;
  results: BatchProgress[];
} = {
  isPaused: false,
  isCancelled: false,
  currentProcesses: new Map(),
  files: [],
  format: "",
  conversionMode: "original",
  results: [],
};

const resetBatchState = () => {
  batchState = {
    isPaused: false,
    isCancelled: false,
    currentProcesses: new Map(),
    files: [],
    format: "",
    conversionMode: "original",
    results: [],
  };
};

const sendBatchProgress = (progress: BatchOverallProgress) => {
  const mainWindow = ipcContext.mainWindow;
  if (mainWindow) {
    mainWindow.webContents.send("batch-progress", progress);
  }
};

const convertSingleFile = async (
  inputPath: string,
  format: string,
  outputDir: string | undefined,
  filenameTemplate: string | undefined,
  conversionMode: ConversionMode,
  hwInfo: HardwareInfo,
  fileIndex: number,
  onProgress?: (percent: number) => void,
): Promise<{
  success: boolean;
  outputPath?: string;
  outputSize?: number;
  error?: string;
  usedStreamCopy?: { video: boolean; audio: boolean };
}> => {
  const dir = outputDir || path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const name = path.basename(inputPath, ext);

  // Apply filename template or use original name
  const outputName = filenameTemplate
    ? applyFilenameTemplate(filenameTemplate, name, format)
    : name;
  let outputPath = path.join(dir, `${outputName}.${format}`);

  // Prevent overwriting input file - add suffix if paths are identical
  if (path.resolve(outputPath) === path.resolve(inputPath)) {
    outputPath = path.join(dir, `${outputName}_converted.${format}`);
  }

  let totalDuration = 0;
  try {
    totalDuration = await getVideoDuration(inputPath);
  } catch {
    // Continue without duration info
  }

  // Check if smart copy is possible for video and audio separately
  // Smart copy is only used in "original" mode
  let copyVideo = false;
  let copyAudio = false;
  if (conversionMode === "original") {
    const { videoCodec: srcVideoCodec, audioCodec: srcAudioCodec } =
      await getVideoCodec(inputPath);
    const copyCheck = canUseStreamCopy(srcVideoCodec, srcAudioCodec, format);
    copyVideo = copyCheck.video;
    copyAudio = copyCheck.audio;
    if (copyVideo || copyAudio) {
      console.log(
        `Smart copy for ${inputPath}: video=${copyVideo} (${srcVideoCodec}), audio=${copyAudio} (${srcAudioCodec}) -> ${format}`,
      );
    }
  }

  // Build FFmpeg arguments
  const args: string[] = [];

  // Hardware decoding (only if not copying video)
  if (!copyVideo) {
    const hwDecoderArgs = getHwDecoderArgs(hwInfo.hwDecoder);
    args.push(...hwDecoderArgs);
  }

  args.push("-i", inputPath);

  // Video codec arguments
  if (copyVideo) {
    args.push("-c:v", "copy");
  } else {
    // Get encoder args (this handles video codec selection)
    const encoderArgs = getEncoderArgs(
      format,
      hwInfo.gpuAccel,
      conversionMode,
      hwInfo.cpuThreads,
      hwInfo.hevcSupport,
    );
    // Filter out audio-related args, we'll handle audio separately
    const videoArgs = encoderArgs.filter((arg, idx, arr) => {
      if (arg === "-c:a" || arg === "-vn") return false;
      if (idx > 0 && arr[idx - 1] === "-c:a") return false;
      if (idx > 0 && arr[idx - 1] === "-q:a") return false;
      if (arg === "-q:a") return false;
      return true;
    });
    args.push(...videoArgs);
  }

  // Audio codec arguments (for video formats)
  if (!["gif"].includes(format)) {
    if (copyAudio) {
      args.push("-c:a", "copy");
    } else if (format === "webm") {
      args.push("-c:a", "libopus");
    } else if (format === "wmv") {
      args.push("-c:a", "wmav2");
    } else if (format === "mp3") {
      const mp3Quality =
        speedPreset === "fast" ? "4" : speedPreset === "balanced" ? "2" : "0";
      args.push("-vn", "-c:a", "libmp3lame", "-q:a", mp3Quality);
    } else if (format === "wav") {
      args.push("-vn", "-c:a", "pcm_s16le");
    } else {
      args.push("-c:a", "aac");
    }
  }

  args.push("-y", outputPath);

  const subprocess = execa(FFMPEG_BIN, args);
  batchState.currentProcesses.set(fileIndex, subprocess);

  subprocess.stderr?.on("data", (data) => {
    const output = data.toString();
    const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);

    if (timeMatch && totalDuration > 0 && onProgress) {
      const currentTime = parseTime(timeMatch[1]);
      const percent = Math.round((currentTime / totalDuration) * 100);
      onProgress(Math.min(percent, 99));
    }
  });

  try {
    await subprocess;
    batchState.currentProcesses.delete(fileIndex);

    // Get output file size
    let outputSize = 0;
    try {
      const stats = fs.statSync(outputPath);
      outputSize = stats.size;
    } catch {
      // Ignore if file size cannot be retrieved
    }

    return {
      success: true,
      outputPath,
      outputSize,
      usedStreamCopy: { video: copyVideo, audio: copyAudio },
    };
  } catch (error: unknown) {
    batchState.currentProcesses.delete(fileIndex);
    const err = error as Error & { killed?: boolean };
    if (err.killed || batchState.isCancelled) {
      return { success: false, error: "Cancelled" };
    }
    return { success: false, error: err.message };
  }
};

export const batchConvert = os
  .input(batchConvertSchema)
  .handler(
    async ({
      input: {
        files,
        format,
        outputDir,
        filenameTemplate,
        conversionMode = "original",
        parallelCount = 1,
      },
    }) => {
      resetBatchState();
      batchState.files = files;
      batchState.format = format;
      batchState.outputDir = outputDir;
      batchState.conversionMode = conversionMode;
      batchState.results = files.map((filePath, index) => ({
        fileIndex: index,
        filePath,
        status: "pending" as const,
        progress: 0,
      }));

      // Get hardware info once for all conversions
      const hwInfo = await fetchHardwareInfo();

      let completed = 0;
      let failed = 0;

      // Process files with parallelCount concurrency
      const processFile = async (fileIndex: number): Promise<void> => {
        // Check if cancelled
        if (batchState.isCancelled) {
          batchState.results[fileIndex].status = "cancelled";
          return;
        }

        // Wait while paused
        while (batchState.isPaused && !batchState.isCancelled) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (batchState.isCancelled) {
          batchState.results[fileIndex].status = "cancelled";
          return;
        }

        const filePath = files[fileIndex];
        batchState.results[fileIndex].status = "converting";
        batchState.results[fileIndex].progress = 0;

        sendBatchProgress({
          total: files.length,
          completed,
          failed,
          isPaused: batchState.isPaused,
          currentFile: batchState.results[fileIndex],
        });

        const result = await convertSingleFile(
          filePath,
          format,
          outputDir,
          filenameTemplate,
          conversionMode,
          hwInfo,
          fileIndex,
          (percent) => {
            batchState.results[fileIndex].progress = percent;
            sendBatchProgress({
              total: files.length,
              completed,
              failed,
              isPaused: batchState.isPaused,
              currentFile: batchState.results[fileIndex],
            });
          },
        );

        if (result.success) {
          batchState.results[fileIndex].status = "completed";
          batchState.results[fileIndex].progress = 100;
          batchState.results[fileIndex].outputPath = result.outputPath;
          batchState.results[fileIndex].outputSize = result.outputSize;
          completed++;
        } else if (result.error === "Cancelled") {
          batchState.results[fileIndex].status = "cancelled";
        } else {
          batchState.results[fileIndex].status = "failed";
          batchState.results[fileIndex].error = result.error;
          failed++;
        }

        sendBatchProgress({
          total: files.length,
          completed,
          failed,
          isPaused: batchState.isPaused,
          currentFile: batchState.results[fileIndex],
        });
      };

      // Process files with limited concurrency
      const effectiveParallel = Math.min(parallelCount, files.length);
      const queue = [...Array(files.length).keys()]; // [0, 1, 2, ...]
      const workers: Promise<void>[] = [];

      const worker = async () => {
        while (queue.length > 0 && !batchState.isCancelled) {
          const fileIndex = queue.shift();
          if (fileIndex !== undefined) {
            await processFile(fileIndex);
          }
        }
      };

      // Start workers
      for (let i = 0; i < effectiveParallel; i++) {
        workers.push(worker());
      }

      // Wait for all workers to complete
      await Promise.all(workers);

      // Mark remaining files as cancelled if batch was cancelled
      if (batchState.isCancelled) {
        for (const result of batchState.results) {
          if (result.status === "pending") {
            result.status = "cancelled";
          }
        }
      }

      // Send completion notification
      if (!batchState.isCancelled) {
        const title = "Conversion Complete";
        const body =
          failed > 0
            ? `Completed: ${completed}, Failed: ${failed}`
            : `Successfully converted ${completed} file${completed > 1 ? "s" : ""}`;
        sendNotification(title, body);
      }

      return {
        total: files.length,
        completed,
        failed,
        results: batchState.results,
      };
    },
  );

export const batchControl = os
  .input(batchControlSchema)
  .handler(async ({ input: { action } }) => {
    switch (action) {
      case "pause":
        batchState.isPaused = true;
        break;
      case "resume":
        batchState.isPaused = false;
        break;
      case "cancel":
        batchState.isCancelled = true;
        batchState.isPaused = false;
        // Kill all running processes
        for (const [, process] of batchState.currentProcesses) {
          process.kill("SIGTERM");
        }
        break;
    }
    return { success: true, action };
  });
