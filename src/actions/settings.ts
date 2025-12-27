import { ipc } from "@/ipc/manager";
import type { Settings, UpdateSettingsInput } from "@/ipc/settings/schemas";

export async function getSettings(): Promise<Settings> {
  return await ipc.client.settings.get();
}

export async function updateSettings(input: UpdateSettingsInput): Promise<Settings> {
  return await ipc.client.settings.set(input);
}
