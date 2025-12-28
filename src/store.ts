import { app } from "electron";
import Store from "electron-store";
import type { Settings } from "./ipc/settings/schemas";

function getDefaultSettings(): Settings {
  const systemLocale = app.getLocale();
  const defaultLanguage = systemLocale.startsWith("zh") ? "zh" : "en";

  return {
    theme: "system",
    language: defaultLanguage,
    clipboardShortcut: "CommandOrControl+Shift+V",
    clipboardAlwaysOnTop: true,
    lastRoute: "/",
    autoLaunch: false,
  };
}

// Singleton electron-store instance
export const settingsStore = new Store<Settings>({
  name: "settings",
  defaults: getDefaultSettings(),
});
