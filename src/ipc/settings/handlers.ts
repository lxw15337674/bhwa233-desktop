import { os } from "@orpc/server";
import { app } from "electron";
import Store from "electron-store";
import { settingsSchema, updateSettingsInputSchema, type Settings } from "./schemas";

const store = new Store<Settings>({
  name: "settings",
  defaults: getDefaultSettings(),
});

function getDefaultSettings(): Settings {
  const systemLocale = app.getLocale();
  const defaultLanguage = systemLocale.startsWith("zh") ? "zh" : "en";

  return {
    theme: "system",
    language: defaultLanguage,
    clipboardShortcut: "CommandOrControl+Shift+V",
  };
}

export const getSettings = os.handler(() => {
  const settings = store.store;
  return settingsSchema.parse(settings);
});

export const setSettings = os
  .input(updateSettingsInputSchema)
  .handler(({ input }) => {
    const currentSettings = store.store;
    const updatedSettings = { ...currentSettings, ...input };
    store.store = updatedSettings;
    return settingsSchema.parse(updatedSettings);
  });
