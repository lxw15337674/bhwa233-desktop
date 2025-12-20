import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "path";

let tray: Tray | null = null;

const getTrayIconPath = (): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "logo.png");
  }
  return path.join(process.cwd(), "resources", "logo.png");
};

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  // Resize for better display on different platforms
  const trayIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip("Video Converter");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => {
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
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
