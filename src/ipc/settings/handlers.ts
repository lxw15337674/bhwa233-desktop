import { os } from "@orpc/server";
import { settingsStore } from "@/store";
import { settingsSchema, updateSettingsInputSchema } from "./schemas";

export const getSettings = os.handler(() => {
  const settings = settingsStore.store;
  return settingsSchema.parse(settings);
});

export const setSettings = os
  .input(updateSettingsInputSchema)
  .handler(({ input }) => {
    const currentSettings = settingsStore.store;
    const updatedSettings = { ...currentSettings, ...input };
    settingsStore.store = updatedSettings;
    return settingsSchema.parse(updatedSettings);
  });
