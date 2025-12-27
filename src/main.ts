import { app, BrowserWindow, globalShortcut, dialog } from "electron";
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
import type { Settings } from "./ipc/settings/schemas";

const inDevelopment = process.env.NODE_ENV === "development";
let isQuitting = false;
const settingsStore = new Store<Settings>({ name: "settings" });

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "logo.png")
    : path.join(process.cwd(), "resources", "logo.png");

  const mainWindow = new BrowserWindow({
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
  });
  mainWindow.maximize();
  ipcContext.setMainWindow(mainWindow);

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Create system tray
  createTray(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
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
  // Start clipboard watcher
  startClipboardWatcher();

  // Register global shortcut
  registerClipboardShortcut();
}

function registerClipboardShortcut() {
  // Unregister existing shortcut
  globalShortcut.unregisterAll();

  // Get shortcut from settings
  const shortcut = settingsStore.get(
    "clipboardShortcut",
    "CommandOrControl+Shift+V"
  );

  // Register new shortcut
  const success = globalShortcut.register(shortcut, () => {
    toggleClipboardWindow();
  });

  if (!success) {
    console.error("Failed to register global shortcut:", shortcut);
    dialog.showErrorBox(
      "Shortcut Registration Failed",
      `Failed to register global shortcut: ${shortcut}\nIt may be in use by another application.`
    );
  } else {
    console.log("Global shortcut registered:", shortcut);
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
  .then(setupClipboard);

// Set isQuitting flag before quit
app.on("before-quit", () => {
  isQuitting = true;
  stopClipboardWatcher();
  globalShortcut.unregisterAll();
  destroyTray();
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
