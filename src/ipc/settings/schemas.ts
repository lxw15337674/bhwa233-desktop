import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);
export const languageSchema = z.enum(["en", "zh"]);

export const windowBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const settingsSchema = z.object({
  theme: themeSchema,
  language: languageSchema,
  clipboardShortcut: z.string().default("CommandOrControl+Shift+V"),
  clipboardWindowBounds: windowBoundsSchema.optional(),
  clipboardAlwaysOnTop: z.boolean().default(true),
  mainWindowBounds: windowBoundsSchema.optional(),
  lastRoute: z.string().default("/"),
  autoLaunch: z.boolean().default(false),
});

export const updateSettingsInputSchema = z.object({
  theme: themeSchema.optional(),
  language: languageSchema.optional(),
  clipboardShortcut: z.string().optional(),
  clipboardWindowBounds: windowBoundsSchema.optional(),
  clipboardAlwaysOnTop: z.boolean().optional(),
  mainWindowBounds: windowBoundsSchema.optional(),
  lastRoute: z.string().optional(),
  autoLaunch: z.boolean().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
export type WindowBounds = z.infer<typeof windowBoundsSchema>;
