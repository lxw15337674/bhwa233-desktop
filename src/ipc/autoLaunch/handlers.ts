import { app } from "electron";
import { os } from "@orpc/server";
import { enableAutoLaunchInputSchema } from "./schemas";
import Store from "electron-store";
import type { Settings } from "../settings/schemas";

const settingsStore = new Store<Settings>({ name: "settings" });

export const setAutoLaunchHandler = os
  .input(enableAutoLaunchInputSchema)
  .handler(({ input: { enable } }) => {
    // Update system login item settings
    app.setLoginItemSettings({
      openAtLogin: enable,
    });

    // Update settings store
    settingsStore.set("autoLaunch", enable);

    return { success: true };
  });

export const getAutoLaunchStatusHandler = os.handler(() => {
  const loginItemSettings = app.getLoginItemSettings();
  return {
    enabled: loginItemSettings.openAtLogin,
  };
});
