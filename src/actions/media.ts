import { ipc } from "@/ipc/manager";

export async function convertVideo(inputPath: string, format: string) {
  return ipc.client.media.convertVideo({ inputPath, format });
}
