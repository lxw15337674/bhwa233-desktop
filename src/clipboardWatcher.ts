import { clipboard } from "electron";
import {
  addClipboardRecord,
  saveClipboardImage,
} from "./ipc/clipboard/handlers";

let previousText = "";
let previousImageDataURL = "";
let watcherInterval: NodeJS.Timeout | null = null;

export function startClipboardWatcher() {
  if (watcherInterval) {
    return; // Already running
  }

  // Initialize with current clipboard content
  previousText = clipboard.readText();
  const currentImage = clipboard.readImage();
  if (!currentImage.isEmpty()) {
    previousImageDataURL = currentImage.toDataURL();
  }

  // Check clipboard every 500ms
  watcherInterval = setInterval(() => {
    try {
      // Check for text
      const currentText = clipboard.readText();
      if (currentText && currentText !== previousText) {
        previousText = currentText;
        addClipboardRecord("text", currentText);
      }

      // Check for image
      const currentImage = clipboard.readImage();
      if (!currentImage.isEmpty()) {
        const currentDataURL = currentImage.toDataURL();
        if (currentDataURL !== previousImageDataURL) {
          previousImageDataURL = currentDataURL;
          const imagePath = saveClipboardImage();
          if (imagePath) {
            addClipboardRecord("image", imagePath);
          }
        }
      }
    } catch (error) {
      console.error("Clipboard watcher error:", error);
    }
  }, 500);

  console.log("Clipboard watcher started");
}

export function stopClipboardWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    console.log("Clipboard watcher stopped");
  }
}
