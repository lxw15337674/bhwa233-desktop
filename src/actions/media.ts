import { ipc } from "@/ipc/manager";
import type { VideoInfo } from "@/ipc/media/schemas";

export async function convertVideo(inputPath: string, format: string) {
  return ipc.client.media.convertVideo({ inputPath, format });
}

export async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  return ipc.client.media.getVideoInfo({ inputPath });
}

export type { VideoInfo };
