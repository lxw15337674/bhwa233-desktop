import { ipc } from "@/ipc/manager";
import type {
  DetectFileLocksOutput,
  ForceDeleteFileOutput,
  IsAdminOutput,
  SelectFileOutput,
} from "@/ipc/filesystem/schemas";

export function isAdmin(): Promise<IsAdminOutput> {
  return ipc.client.filesystem.isAdmin();
}

export function selectFile(): Promise<SelectFileOutput> {
  return ipc.client.filesystem.selectFile();
}

export function detectFileLocks(filePath: string): Promise<DetectFileLocksOutput> {
  return ipc.client.filesystem.detectFileLocks({ filePath });
}

export function forceDeleteFile(
  filePath: string,
  killProcessIds: number[] = []
): Promise<ForceDeleteFileOutput> {
  return ipc.client.filesystem.forceDeleteFile({ filePath, killProcessIds });
}
