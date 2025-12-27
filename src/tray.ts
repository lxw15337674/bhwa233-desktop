import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "path";
import log from "electron-log";

let tray: Tray | null = null;

const getTrayIconPath = (): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "logo.png");
  }
  return path.join(process.cwd(), "resources", "logo.png");
};

export function createTray(mainWindow: BrowserWindow): Tray {
  log.info("Creating system tray...");
  const iconPath = getTrayIconPath();
  log.info("Tray icon path:", iconPath);
  const icon = nativeImage.createFromPath(iconPath);

  // Resize for better display on different platforms
  const trayIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip("Video Converter");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => {
        log.info("Tray: Show Window clicked");
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      click: () => {
        log.info("Tray: Quit clicked");
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on("double-click", () => {
    log.info("Tray: Double-clicked");
    mainWindow.show();
    mainWindow.focus();
  });

  log.info("✅ System tray created successfully");
  return tray;
}

export function destroyTray(): void {
  if (tray) {
    log.info("Destroying system tray");
    tray.destroy();
    tray = null;
  }
}
