import type { i18n } from "i18next";
import { getSettings, updateSettings } from "./settings";

export async function setAppLanguage(lang: string, i18n: i18n) {
  await updateSettings({ language: lang as "en" | "zh" });
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export async function updateAppLanguage(i18n: i18n) {
  const settings = await getSettings();
  i18n.changeLanguage(settings.language);
  document.documentElement.lang = settings.language;
}
