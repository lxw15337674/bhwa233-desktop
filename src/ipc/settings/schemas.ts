import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);
export const languageSchema = z.enum(["en", "zh"]);

export const settingsSchema = z.object({
  theme: themeSchema,
  language: languageSchema,
});

export const updateSettingsInputSchema = z.object({
  theme: themeSchema.optional(),
  language: languageSchema.optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
