import { z } from "zod";

export const convertVideoSchema = z.object({
  inputPath: z.string(),
  format: z.string(),
});

export const getVideoInfoSchema = z.object({
  inputPath: z.string(),
});

export const videoInfoSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  codec: z.string(),
  bitrate: z.number(),
  fps: z.number(),
  size: z.number(),
  format: z.string(),
});

export type VideoInfo = z.infer<typeof videoInfoSchema>;

// Hardware info
export type GpuAccelType = "nvenc" | "qsv" | "amf" | "none";

export interface HardwareInfo {
  gpuAccel: GpuAccelType;
  gpuName: string;
  cpuThreads: number;
  hwDecoder: string; // Hardware decoder name (cuda, qsv, d3d11va, none)
  hevcSupport: boolean; // Whether GPU supports HEVC encoding
}

// Conversion modes
export type ConversionMode = "original" | "highQuality" | "fast";

// Batch conversion schemas
export const batchConvertSchema = z.object({
  files: z.array(z.string()),
  format: z.string(),
  outputDir: z.string().optional(),
  filenameTemplate: z.string().optional(), // Template: {name}, {date}, {time}, {format}
  conversionMode: z.enum(["original", "highQuality", "fast"]).optional(), // Conversion mode
  parallelCount: z.number().min(1).max(4).optional(), // 1-4 parallel conversions
});

export const batchControlSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

export type BatchFileStatus =
  | "pending"
  | "converting"
  | "completed"
  | "failed"
  | "cancelled";

export interface BatchProgress {
  fileIndex: number;
  filePath: string;
  status: BatchFileStatus;
  progress: number;
  error?: string;
  outputPath?: string;
  outputSize?: number;
}

export interface BatchOverallProgress {
  total: number;
  completed: number;
  failed: number;
  isPaused: boolean;
  currentFile?: BatchProgress;
}
