import z from "zod";

export const openExternalLinkInputSchema = z.object({
  url: z.url(),
});

export const openFolderInputSchema = z.object({
  path: z.string(),
});

export const showItemInFolderInputSchema = z.object({
  path: z.string(),
});
