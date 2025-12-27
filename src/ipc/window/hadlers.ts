import { os } from "@orpc/server";
import { ipcContext } from "../context";
import { z } from "zod";
import Store from "electron-store";
import type { Settings } from "../settings/schemas";

const settingsStore = new Store<Settings>({ name: "settings" });

export const minimizeWindow = os
  .use(ipcContext.mainWindowContext)
  .handler(({ context }) => {
    const { window } = context;

    window.minimize();
  });

export const maximizeWindow = os
  .use(ipcContext.mainWindowContext)
  .handler(({ context }) => {
    const { window } = context;

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

export const closeWindow = os
  .use(ipcContext.mainWindowContext)
  .handler(({ context }) => {
    const { window } = context;

    window.close();
  });

export const setAlwaysOnTop = os
  .input(z.object({ alwaysOnTop: z.boolean() }))
  .handler(({ input }) => {
    const { alwaysOnTop } = input;
    const currentWindow = require("electron").BrowserWindow.getFocusedWindow();

    if (currentWindow) {
      currentWindow.setAlwaysOnTop(alwaysOnTop, "screen-saver", 1);

      // Save preference for clipboard window
      settingsStore.set("clipboardAlwaysOnTop", alwaysOnTop);

      return { success: true, alwaysOnTop };
    }

    return { success: false, alwaysOnTop: false };
  });
