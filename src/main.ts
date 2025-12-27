import { app, BrowserWindow, globalShortcut, dialog, screen } from "electron";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import { ipcMain } from "electron/main";
import { ipcContext } from "@/ipc/context";
import { IPC_CHANNELS } from "./constants";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { createTray, destroyTray } from "./tray";
import { startClipboardWatcher, stopClipboardWatcher } from "./clipboardWatcher";
import { toggleClipboardWindow } from "./clipboardWindowManager";
import Store from "electron-store";
import type { Settings, WindowBounds } from "./ipc/settings/schemas";
import log from "electron-log";

// Configure electron-log
log.transports.console.level = "debug";
log.transports.file.level = "info";

log.info("========================================");
log.info("Application starting...");
log.info("Environment:", process.env.NODE_ENV);
log.info("========================================");

const inDevelopment = process.env.NODE_ENV === "development";
let isQuitting = false;
const settingsStore = new Store<Settings>({ name: "settings" });
let saveWindowBoundsTimeout: NodeJS.Timeout | null = null;

// Get default main window bounds (centered on primary display)
function getDefaultMainWindowBounds(): WindowBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 1200;
  const windowHeight = 800;

  return {
    x: Math.floor((width - windowWidth) / 2),
    y: Math.floor((height - windowHeight) / 2),
    width: windowWidth,
    height: windowHeight,
  };
}

// Validate window bounds are within screen boundaries
function validateWindowBounds(bounds: WindowBounds): WindowBounds | null {
  const displays = screen.getAllDisplays();

  // Check if window position is within any display
  const isPositionValid = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return (
      bounds.x >= x &&
      bounds.x < x + width &&
      bounds.y >= y &&
      bounds.y < y + height
    );
  });

  if (!isPositionValid) {
    return null;
  }

  // Check if window size is reasonable
  const minWidth = 800;
  const minHeight = 600;
  const maxDisplay = displays.reduce((max, display) => {
    return display.bounds.width > max.width ? display.bounds : max;
  }, displays[0].bounds);

  if (
    bounds.width < minWidth ||
    bounds.height < minHeight ||
    bounds.width > maxDisplay.width ||
    bounds.height > maxDisplay.height
  ) {
    return null;
  }

  return bounds;
}

// Save main window bounds with debounce
function saveMainWindowBounds(mainWindow: BrowserWindow) {
  if (saveWindowBoundsTimeout) {
    clearTimeout(saveWindowBoundsTimeout);
  }

  saveWindowBoundsTimeout = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    // Don't save if maximized or fullscreen
    if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
      return;
    }

    const bounds = mainWindow.getBounds();
    settingsStore.set("mainWindowBounds", bounds);
  }, 500); // 500ms debounce
}

function createWindow() {
  log.info("Creating main window...");
  const preload = path.join(__dirname, "preload.js");

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "logo.png")
    : path.join(process.cwd(), "resources", "logo.png");

  // Get saved window bounds or use default
  const savedBounds = settingsStore.get("mainWindowBounds");
  const defaultBounds = getDefaultMainWindowBounds();
  const validatedBounds = savedBounds
    ? validateWindowBounds(savedBounds) || defaultBounds
    : defaultBounds;

  log.info("Main window bounds:", validatedBounds);

  const mainWindow = new BrowserWindow({
    ...validatedBounds,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      webSecurity: false,
      preload: preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 5, y: 5 } : undefined,
    show: false, // Don't show initially, we'll control when to show
  });

  // Check if app was opened at login
  const wasOpenedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin;
  log.info("Was opened at login:", wasOpenedAtLogin);

  // Only show/maximize if not opened at login
  if (!wasOpenedAtLogin) {
    mainWindow.show();
    log.info("Main window shown");
  } else {
    log.info("Auto-launch detected, keeping window hidden");
  }

  ipcContext.setMainWindow(mainWindow);

  // Open DevTools in development mode
  if (inDevelopment) {
    mainWindow.webContents.once('did-finish-load', () => {
      log.info("Main window loaded, opening DevTools...");
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  }

  // Setup window event handlers
  // Save bounds when window is resized or moved
  mainWindow.on("resize", () => saveMainWindowBounds(mainWindow));
  mainWindow.on("move", () => saveMainWindowBounds(mainWindow));

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      log.info("Main window hidden to tray");
    }
  });

  // Create system tray
  createTray(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    log.info("Loading dev server URL:", MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    mainWindow.loadFile(htmlPath);
    log.info("Loading HTML file:", htmlPath);
  }

  log.info("Main window created successfully");
}

async function installExtensions() {
  log.info("Installing React Developer Tools...");
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    log.info(`✅ Extensions installed successfully: ${result.name}`);
  } catch (error) {
    log.error("❌ Failed to install extensions:", error);
  }
}

function checkForUpdates() {
  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: "LuanRoger/bhwa233-tools",
    },
  });
}

async function setupORPC() {
  const { rpcHandler } = await import("./ipc/handler");

  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, (event) => {
    const [serverPort] = event.ports;

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

function setupClipboard() {
  log.info("Setting up clipboard functionality...");
  // Start clipboard watcher
  startClipboardWatcher();
  log.info("Clipboard watcher started");

  // Register global shortcut
  registerClipboardShortcut();
}

function syncAutoLaunchSettings() {
  log.info("Syncing auto-launch settings...");
  // Sync autoLaunch setting with system
  const autoLaunchEnabled = settingsStore.get("autoLaunch", false);
  log.info("Auto-launch enabled:", autoLaunchEnabled);
  app.setLoginItemSettings({
    openAtLogin: autoLaunchEnabled,
  });
  log.info("Auto-launch settings synced");
}

function registerClipboardShortcut() {
  log.info("Registering clipboard shortcut...");

  // Unregister existing shortcut
  globalShortcut.unregisterAll();

  // Get user's preferred shortcut
  const preferredShortcut = settingsStore.get(
    "clipboardShortcut",
    "CommandOrControl+Shift+V"
  );

  // Fallback shortcuts if preferred one is taken
  const fallbackShortcuts = [
    preferredShortcut,
    "CommandOrControl+Alt+V",
    "CommandOrControl+Shift+C",
    "Alt+Shift+V",
  ];

  log.info("Preferred shortcut:", preferredShortcut);

  let registeredShortcut: string | null = null;
  let usedFallback = false;

  // Try to register shortcuts in order
  for (const shortcut of fallbackShortcuts) {
    const success = globalShortcut.register(shortcut, () => {
      log.info("🔥🔥🔥 CLIPBOARD SHORTCUT TRIGGERED! 🔥🔥🔥");
      try {
        // Get main window state before showing clipboard window
        const mainWindow = ipcContext.getMainWindow();
        const wasMainWindowVisible = mainWindow?.isVisible();
        log.info("Main window visible before shortcut:", wasMainWindowVisible);

        // Show clipboard window
        toggleClipboardWindow();

        // Ensure main window stays hidden if it was hidden
        if (mainWindow && !wasMainWindowVisible) {
          log.info("Ensuring main window stays hidden");
          if (mainWindow.isVisible()) {
            log.warn("Main window was unexpectedly shown, hiding it");
            mainWindow.hide();
          }
        }

        log.info("toggleClipboardWindow() completed");
      } catch (error) {
        log.error("❌ Error in toggleClipboardWindow:", error);
      }
    });

    if (success) {
      registeredShortcut = shortcut;
      usedFallback = shortcut !== preferredShortcut;
      log.info("✅ Global shortcut registered successfully:", shortcut);
      break;
    } else {
      log.warn(`⚠️ Failed to register shortcut: ${shortcut} (already in use)`);
    }
  }

  if (!registeredShortcut) {
    // All shortcuts failed
    log.error("❌ Failed to register any clipboard shortcut");
    dialog.showErrorBox(
      "Shortcut Registration Failed",
      `Failed to register clipboard shortcut. All attempted shortcuts are in use:\n${fallbackShortcuts.join("\n")}\n\nPlease close other applications and restart, or change the shortcut in settings.`
    );
  } else if (usedFallback) {
    // Successfully registered but used fallback
    log.warn(`⚠️ Using fallback shortcut: ${registeredShortcut}`);
    // TODO: Show notification to user about fallback shortcut
    // For now, just log it. In future, add system notification here.
    log.info(`💡 Your preferred shortcut "${preferredShortcut}" was taken, using "${registeredShortcut}" instead`);
  }
}

// Export for settings changes
export { registerClipboardShortcut };

app
  .whenReady()
  .then(createWindow)
  .then(installExtensions)
  .then(checkForUpdates)
  .then(setupORPC)
  .then(setupClipboard)
  .then(syncAutoLaunchSettings);

// Set isQuitting flag before quit
app.on("before-quit", () => {
  log.info("Application quitting...");
  isQuitting = true;
  stopClipboardWatcher();
  globalShortcut.unregisterAll();
  destroyTray();
  log.info("Cleanup completed");
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
