import type { ClipboardUpdateEvent } from "./preload";
import type { BatchOverallProgress } from "./ipc/media/schemas";

interface Window {
  electron?: {
    getFilePath: (file: File) => string;
    onNavigate: (callback: (path: string) => void) => () => void;
    onClipboardUpdate: (callback: (event: ClipboardUpdateEvent) => void) => () => void;
    onClipboardWindowOpened: (callback: () => void) => () => void;
  };
  media?: {
    onProgress: (callback: (progress: number) => void) => () => void;
    onBatchProgress: (callback: (progress: BatchOverallProgress) => void) => () => void;
  };
}
