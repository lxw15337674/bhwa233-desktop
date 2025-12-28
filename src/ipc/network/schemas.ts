import { z } from "zod";

// Process information schema
export const processInfoSchema = z.object({
  pid: z.number(),
  name: z.string(),
  path: z.string().nullable(),
  canTerminate: z.boolean(),
  isService: z.boolean(),
  error: z.string().optional(),
});

export type ProcessInfo = z.infer<typeof processInfoSchema>;

// Port information schema
export const portInfoSchema = z.object({
  port: z.number(),
  protocol: z.enum(["TCP", "UDP"]),
  addresses: z.array(z.string()),
  process: processInfoSchema,
});

export type PortInfo = z.infer<typeof portInfoSchema>;

// Get listening ports output schema
export const getListeningPortsOutputSchema = z.object({
  success: z.boolean(),
  ports: z.array(portInfoSchema),
  message: z.string(),
  error: z.string().optional(),
});

export type GetListeningPortsOutput = z.infer<typeof getListeningPortsOutputSchema>;

// Kill process input schema
export const killProcessInputSchema = z.object({
  processId: z.number(),
});

export type KillProcessInput = z.infer<typeof killProcessInputSchema>;

// Kill process output schema
export const killProcessOutputSchema = z.object({
  success: z.boolean(),
  pid: z.number(),
  name: z.string().optional(),
  path: z.string().nullable().optional(),
  gracefulClose: z.boolean().optional(),
  message: z.string(),
  error: z.string().optional(),
});

export type KillProcessOutput = z.infer<typeof killProcessOutputSchema>;

// Process I/O statistics schema
export const processIOStatSchema = z.object({
  pid: z.number(),
  name: z.string(),
  readBytes: z.number(),
  writeBytes: z.number(),
  totalBytes: z.number(),
});

export type ProcessIOStat = z.infer<typeof processIOStatSchema>;

// Get process I/O output schema
export const getProcessIOOutputSchema = z.object({
  success: z.boolean(),
  processes: z.array(processIOStatSchema),
  timestamp: z.number(),
  message: z.string(),
  error: z.string().optional(),
});

export type GetProcessIOOutput = z.infer<typeof getProcessIOOutputSchema>;
