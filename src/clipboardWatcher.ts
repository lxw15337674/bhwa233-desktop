import { clipboard } from "electron";
import ClipboardWatcher from "electron-clipboard-watcher";
import crypto from "crypto";
import {
  addClipboardRecord,
  saveClipboardImage,
} from "./ipc/clipboard/handlers";
import log from "electron-log";

let previousText = "";
let previousImageHash = "";
let watcher: ClipboardWatcher | null = null;

// Calculate MD5 hash for image data
function calculateImageHash(imageBuffer: Buffer): string {
  return crypto.createHash("md5").update(imageBuffer).digest("hex");
}

// Handle clipboard change event
function handleClipboardChange() {
  try {
    // Check for text
    const currentText = clipboard.readText();
    if (currentText && currentText !== previousText) {
      log.info("New clipboard text detected");
      previousText = currentText;
      addClipboardRecord("text", currentText);
      return; // Prioritize text over image
    }

    // Check for image
    const currentImage = clipboard.readImage();
    if (!currentImage.isEmpty()) {
      const imageBuffer = currentImage.toPNG();
      const currentHash = calculateImageHash(imageBuffer);

      if (currentHash !== previousImageHash) {
        log.info("New clipboard image detected (hash:", currentHash, ")");
        previousImageHash = currentHash;
        const imagePath = saveClipboardImage();
        if (imagePath) {
          log.info("Clipboard image saved:", imagePath);
          addClipboardRecord("image", imagePath);
        }
      }
    }
  } catch (error) {
    log.error("❌ Clipboard change handler error:", error);
  }
}

export function startClipboardWatcher() {
  log.info("📋 Starting clipboard watcher (electron-clipboard-watcher)...");
  if (watcher) {
    log.info("Clipboard watcher already running");
    return; // Already running
  }

  // Initialize with current clipboard content
  previousText = clipboard.readText();
  log.info("Initial clipboard text:", previousText ? "present" : "empty");

  const currentImage = clipboard.readImage();
  if (!currentImage.isEmpty()) {
    const imageBuffer = currentImage.toPNG();
    previousImageHash = calculateImageHash(imageBuffer);
    log.info("Initial clipboard image: present (hash:", previousImageHash, ")");
  }

  // Create watcher instance
  watcher = new ClipboardWatcher();

  // Listen for clipboard changes
  watcher.on("change", handleClipboardChange);

  // Start watching
  watcher.start();

  log.info("✅ Clipboard watcher started successfully");
}

export function stopClipboardWatcher() {
  if (watcher) {
    watcher.stop();
    watcher = null;
    log.info("Clipboard watcher stopped");
  }
}
