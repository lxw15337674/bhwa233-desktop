import { ThemeMode } from "@/types/theme-mode";
import { ipc } from "@/ipc/manager";
import { getSettings, updateSettings } from "./settings";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  const currentTheme = await ipc.client.theme.getCurrentThemeMode();
  const settings = await getSettings();

  return {
    system: currentTheme,
    local: settings.theme,
  };
}

export async function setTheme(newTheme: ThemeMode) {
  const isDarkMode = newTheme === "dark";
  await ipc.client.theme.setThemeMode(newTheme);
  await updateSettings({ theme: newTheme });
  updateDocumentTheme(isDarkMode);
}

export async function toggleTheme() {
  const isDarkMode = await ipc.client.theme.toggleThemeMode();
  const newTheme = isDarkMode ? "dark" : "light";

  updateDocumentTheme(isDarkMode);
  await updateSettings({ theme: newTheme });
}

export async function syncWithLocalTheme() {
  const settings = await getSettings();
  await setTheme(settings.theme);
}

function updateDocumentTheme(isDarkMode: boolean) {
  if (isDarkMode) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
