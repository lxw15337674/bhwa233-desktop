import {
  ipcRenderer,
  contextBridge,
  webUtils,
  IpcRendererEvent,
} from "electron";
import { IPC_CHANNELS } from "./constants";
import type { BatchOverallProgress } from "./ipc/media/schemas";

window.addEventListener("message", (event) => {
  if (event.data === IPC_CHANNELS.START_ORPC_SERVER) {
    const [serverPort] = event.ports;

    ipcRenderer.postMessage(IPC_CHANNELS.START_ORPC_SERVER, null, [serverPort]);
  }
});

contextBridge.exposeInMainWorld("electron", {
  getFilePath: (file: File) => webUtils.getPathForFile(file),
});

contextBridge.exposeInMainWorld("media", {
  onProgress: (callback: (progress: number) => void) => {
    const handler = (_: IpcRendererEvent, progress: number) =>
      callback(progress);
    ipcRenderer.on("ffmpeg-progress", handler);
    return () => ipcRenderer.off("ffmpeg-progress", handler);
  },
  onBatchProgress: (callback: (progress: BatchOverallProgress) => void) => {
    const handler = (_: IpcRendererEvent, progress: BatchOverallProgress) =>
      callback(progress);
    ipcRenderer.on("batch-progress", handler);
    return () => ipcRenderer.off("batch-progress", handler);
  },
});
