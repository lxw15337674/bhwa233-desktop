import { clipboard } from "electron";
import {
  addClipboardRecord,
  saveClipboardImage,
} from "./ipc/clipboard/handlers";
import log from "electron-log";

let previousText = "";
let previousImageDataURL = "";
let watcherInterval: NodeJS.Timeout | null = null;

export function startClipboardWatcher() {
  log.info("📋 Starting clipboard watcher...");
  if (watcherInterval) {
    log.info("Clipboard watcher already running");
    return; // Already running
  }

  // Initialize with current clipboard content
  previousText = clipboard.readText();
  log.info("Initial clipboard text:", previousText ? "present" : "empty");
  const currentImage = clipboard.readImage();
  if (!currentImage.isEmpty()) {
    previousImageDataURL = currentImage.toDataURL();
    log.info("Initial clipboard image: present");
  }

  // Check clipboard every 500ms
  watcherInterval = setInterval(() => {
    try {
      // Check for text
      const currentText = clipboard.readText();
      if (currentText && currentText !== previousText) {
        log.info("New clipboard text detected");
        previousText = currentText;
        addClipboardRecord("text", currentText);
      }

      // Check for image
      const currentImage = clipboard.readImage();
      if (!currentImage.isEmpty()) {
        const currentDataURL = currentImage.toDataURL();
        if (currentDataURL !== previousImageDataURL) {
          log.info("New clipboard image detected");
          previousImageDataURL = currentDataURL;
          const imagePath = saveClipboardImage();
          if (imagePath) {
            log.info("Clipboard image saved:", imagePath);
            addClipboardRecord("image", imagePath);
          }
        }
      }
    } catch (error) {
      log.error("❌ Clipboard watcher error:", error);
    }
  }, 500);

  log.info("✅ Clipboard watcher started successfully");
}

export function stopClipboardWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    log.info("Clipboard watcher stopped");
  }
}
