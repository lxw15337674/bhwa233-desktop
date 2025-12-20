import { os } from "@orpc/server";
import {
  openExternalLinkInputSchema,
  openFolderInputSchema,
  showItemInFolderInputSchema,
} from "./schemas";
import { shell } from "electron";

export const openExternalLink = os
  .input(openExternalLinkInputSchema)
  .handler(async ({ input }) => {
    const { url } = input;
    shell.openExternal(url);
  });

export const openFolder = os
  .input(openFolderInputSchema)
  .handler(async ({ input }) => {
    const { path } = input;
    await shell.openPath(path);
  });

export const showItemInFolder = os
  .input(showItemInFolderInputSchema)
  .handler(async ({ input }) => {
    const { path } = input;
    shell.showItemInFolder(path);
  });
