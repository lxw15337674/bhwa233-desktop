import { ipc } from "@/ipc/manager";
import type { VideoInfo, BatchProgress, HardwareInfo, SpeedPreset, VideoCodec } from "@/ipc/media/schemas";

export async function convertVideo(inputPath: string, format: string) {
  return ipc.client.media.convertVideo({ inputPath, format });
}

export async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  return ipc.client.media.getVideoInfo({ inputPath });
}

export async function getHardwareInfo(): Promise<HardwareInfo> {
  return ipc.client.media.getHardwareInfo();
}

export async function batchConvert(
  files: string[],
  format: string,
  outputDir?: string,
  filenameTemplate?: string,
  speedPreset?: SpeedPreset,
  parallelCount?: number,
  smartCopy?: boolean,
  videoCodec?: VideoCodec
) {
  return ipc.client.media.batchConvert({ files, format, outputDir, filenameTemplate, speedPreset, parallelCount, smartCopy, videoCodec });
}

export async function selectFolder(): Promise<string | null> {
  return ipc.client.media.selectFolder();
}

export async function batchControl(action: "pause" | "resume" | "cancel") {
  return ipc.client.media.batchControl({ action });
}

export type { VideoInfo, BatchProgress, HardwareInfo, SpeedPreset, VideoCodec };
