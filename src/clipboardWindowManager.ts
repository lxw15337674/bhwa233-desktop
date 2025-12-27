import { BrowserWindow, screen } from "electron";
import path from "path";
import Store from "electron-store";
import type { Settings } from "./ipc/settings/schemas";
import log from "electron-log";

let clipboardWindow: BrowserWindow | null = null;
const store = new Store<Settings>({ name: "settings" });

// Calculate window position near cursor
function getPositionNearCursor(): { x: number; y: number } {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.workArea;

  const windowWidth = 450;
  const windowHeight = 650;
  const margin = 10;

  // Try to position window to the right and below cursor
  let x = cursorPoint.x + 10;
  let y = cursorPoint.y + 10;

  // Adjust if window goes beyond screen bounds
  if (x + windowWidth > displayX + displayWidth) {
    x = displayX + displayWidth - windowWidth - margin;
  }
  if (y + windowHeight > displayY + displayHeight) {
    y = displayY + displayHeight - windowHeight - margin;
  }

  // Ensure window stays within screen
  x = Math.max(displayX + margin, x);
  y = Math.max(displayY + margin, y);

  log.info("Cursor position:", cursorPoint);
  log.info("Display bounds:", display.workArea);
  log.info("Calculated window position:", { x, y });

  return { x, y };
}

export function createClipboardWindow(): BrowserWindow {
  log.info("🪟 Creating clipboard window...");

  if (clipboardWindow && !clipboardWindow.isDestroyed()) {
    log.info("Clipboard window already exists, reusing it");
    return clipboardWindow;
  }

  const preload = path.join(__dirname, "preload.js");
  log.info("Preload script path:", preload);

  const windowWidth = 450;
  const windowHeight = 650;

  // Get saved always-on-top preference (default: true)
  const savedAlwaysOnTop = store.get("clipboardAlwaysOnTop", true);
  log.info("Clipboard always-on-top setting:", savedAlwaysOnTop);

  clipboardWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: savedAlwaysOnTop,
    skipTaskbar: true,
    webPreferences: {
      devTools: process.env.NODE_ENV === "development",
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      preload: preload,
    },
  });

  log.info("Clipboard window created, ID:", clipboardWindow.id);

  // Load clipboard route
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/clipboard`;
    log.info("Loading clipboard window URL (dev):", url);
    clipboardWindow.loadURL(url);
  } else {
    const htmlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    log.info("Loading clipboard window HTML:", htmlPath);
    clipboardWindow.loadFile(htmlPath, { hash: "/clipboard" });
  }

  // Open DevTools in development mode
  if (process.env.NODE_ENV === "development") {
    clipboardWindow.webContents.once('did-finish-load', () => {
      log.info("Clipboard window loaded, opening DevTools...");
      clipboardWindow!.webContents.openDevTools({ mode: 'detach' });
    });
  }

  // Hide on blur (only if not always-on-top)
  clipboardWindow.on("blur", () => {
    if (clipboardWindow && !clipboardWindow.isDestroyed()) {
      // Use setTimeout to delay the check, allowing DevTools to be detected
      setTimeout(() => {
        if (!clipboardWindow || clipboardWindow.isDestroyed()) {
          return;
        }

        // Don't hide if DevTools is focused (in development mode)
        const isDevToolsFocused =
          process.env.NODE_ENV === "development" &&
          clipboardWindow.webContents.isDevToolsOpened() &&
          clipboardWindow.webContents.isDevToolsFocused();

        if (isDevToolsFocused) {
          log.info("Clipboard window lost focus to DevTools, keeping visible");
          return;
        }

        // Don't hide if window is set to always-on-top
        if (clipboardWindow.isAlwaysOnTop()) {
          log.info("Clipboard window is always-on-top, keeping visible");
          return;
        }

        log.info("Clipboard window lost focus, hiding");
        clipboardWindow.hide();
      }, 100); // 100ms delay
    }
  });

  // Intercept close event in production (convert to hide)
  clipboardWindow.on("close", (event) => {
    if (process.env.NODE_ENV !== "development") {
      log.info("Clipboard window close intercepted, hiding instead");
      event.preventDefault();
      clipboardWindow?.hide();
    } else {
      log.info("Clipboard window closed (development mode)");
      clipboardWindow = null;
    }
  });

  // Clean up on closed (development mode only)
  clipboardWindow.on("closed", () => {
    log.info("Clipboard window destroyed");
    clipboardWindow = null;
  });

  log.info("✅ Clipboard window setup complete");
  return clipboardWindow;
}

export function toggleClipboardWindow() {
  log.info("📋 toggleClipboardWindow() called");
  log.info("This function ONLY operates on clipboard window, NOT main window");

  // Create window if it doesn't exist
  if (!clipboardWindow || clipboardWindow.isDestroyed()) {
    log.info("Clipboard window doesn't exist, creating new one");
    clipboardWindow = createClipboardWindow();
  }

  // Toggle visibility
  if (clipboardWindow.isVisible()) {
    log.info("Clipboard window is visible, hiding it");
    clipboardWindow.hide();
    log.info("toggleClipboardWindow() completed - window hidden");
  } else {
    log.info("Clipboard window is hidden, showing it");

    // Position window near cursor
    const position = getPositionNearCursor();
    clipboardWindow.setPosition(position.x, position.y);

    // Restore saved always-on-top setting
    const savedAlwaysOnTop = store.get("clipboardAlwaysOnTop", true);
    clipboardWindow.setAlwaysOnTop(savedAlwaysOnTop, "screen-saver", 1);
    log.info("Restored always-on-top setting:", savedAlwaysOnTop);

    clipboardWindow.show();
    clipboardWindow.focus();

    // Notify renderer to reset state
    clipboardWindow.webContents.send("clipboard-window-opened");

    log.info("Clipboard window shown and focused, ID:", clipboardWindow.id);
    log.info("toggleClipboardWindow() completed - window shown");
  }
}

export function getClipboardWindow(): BrowserWindow | null {
  return clipboardWindow;
}
