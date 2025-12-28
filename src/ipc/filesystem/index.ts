import { detectFileLocks, forceDeleteFile, isAdmin, selectFile } from "./handlers";

export const filesystem = {
  isAdmin,
  selectFile,
  detectFileLocks,
  forceDeleteFile,
};
