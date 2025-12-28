import { z } from "zod";

// Process info returned by Restart Manager
export const processLockInfoSchema = z.object({
  pid: z.number(),
  name: z.string(),
  path: z.string().nullable(),
  appName: z.string(),
  canTerminate: z.boolean(),
  isService: z.boolean(),
  serviceName: z.string().nullable().optional(),
  error: z.string().optional(),
});

// Response from detectFileLocks
export const detectFileLocksOutputSchema = z.object({
  success: z.boolean(),
  filePath: z.string(),
  isLocked: z.boolean(),
  processes: z.array(processLockInfoSchema),
  message: z.string(),
  error: z.string().optional(),
});

// Input for detectFileLocks
export const detectFileLocksInputSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
});

// Process kill result
export const processKillResultSchema = z.object({
  pid: z.number(),
  name: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});

// Response from forceDeleteFile
export const forceDeleteFileOutputSchema = z.object({
  success: z.boolean(),
  filePath: z.string(),
  deleted: z.boolean(),
  killedProcesses: z.array(processKillResultSchema),
  failedProcesses: z.array(processKillResultSchema),
  message: z.string(),
  error: z.string().optional(),
});

// Input for forceDeleteFile
export const forceDeleteFileInputSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
  killProcessIds: z.array(z.number()).default([]),
});

// Check if running as admin
export const isAdminOutputSchema = z.object({
  isAdmin: z.boolean(),
  platform: z.string(),
});

// Response from selectFile
export const selectFileOutputSchema = z.object({
  canceled: z.boolean(),
  filePath: z.string().optional(),
});

// Types
export type ProcessLockInfo = z.infer<typeof processLockInfoSchema>;
export type DetectFileLocksOutput = z.infer<typeof detectFileLocksOutputSchema>;
export type DetectFileLocksInput = z.infer<typeof detectFileLocksInputSchema>;
export type ProcessKillResult = z.infer<typeof processKillResultSchema>;
export type ForceDeleteFileOutput = z.infer<typeof forceDeleteFileOutputSchema>;
export type ForceDeleteFileInput = z.infer<typeof forceDeleteFileInputSchema>;
export type IsAdminOutput = z.infer<typeof isAdminOutputSchema>;
export type SelectFileOutput = z.infer<typeof selectFileOutputSchema>;
