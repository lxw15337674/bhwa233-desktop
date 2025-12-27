import { BrowserWindow, screen } from "electron";
import path from "path";
import Store from "electron-store";
import type { Settings, WindowBounds } from "./ipc/settings/schemas";

let clipboardWindow: BrowserWindow | null = null;
const store = new Store<Settings>({ name: "settings" });

export function createClipboardWindow(): BrowserWindow {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) {
    return clipboardWindow;
  }

  const preload = path.join(__dirname, "preload.js");

  // Get saved bounds or use defaults
  const savedBounds = store.get("clipboardWindowBounds");
  const defaultBounds = getDefaultBounds();
  const bounds = savedBounds || defaultBounds;

  clipboardWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      devTools: process.env.NODE_ENV === "development",
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      preload: preload,
    },
  });

  // Load clipboard route
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    clipboardWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/clipboard`);
  } else {
    clipboardWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: "/clipboard" }
    );
  }

  // Save bounds on resize or move
  clipboardWindow.on("resize", saveBounds);
  clipboardWindow.on("move", saveBounds);

  // Hide on blur
  clipboardWindow.on("blur", () => {
    if (clipboardWindow && !clipboardWindow.isDestroyed()) {
      clipboardWindow.hide();
    }
  });

  // Clean up on close
  clipboardWindow.on("closed", () => {
    clipboardWindow = null;
  });

  return clipboardWindow;
}

export function toggleClipboardWindow() {
  if (!clipboardWindow || clipboardWindow.isDestroyed()) {
    clipboardWindow = createClipboardWindow();
  }

  if (clipboardWindow.isVisible()) {
    clipboardWindow.hide();
  } else {
    clipboardWindow.show();
    clipboardWindow.focus();
  }
}

export function getClipboardWindow(): BrowserWindow | null {
  return clipboardWindow;
}

function getDefaultBounds(): WindowBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 450;
  const windowHeight = 650;

  return {
    x: Math.floor((width - windowWidth) / 2),
    y: Math.floor((height - windowHeight) / 2),
    width: windowWidth,
    height: windowHeight,
  };
}

function saveBounds() {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) {
    const bounds = clipboardWindow.getBounds();
    store.set("clipboardWindowBounds", bounds);
  }
}
