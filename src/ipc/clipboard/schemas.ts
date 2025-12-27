import { z } from "zod";

export const clipboardRecordTypeSchema = z.enum(["text", "image"]);

export const clipboardRecordSchema = z.object({
  id: z.string(),
  type: clipboardRecordTypeSchema,
  content: z.string(), // text content or image file path
  timestamp: z.number(),
  preview: z.string(), // preview text (first 100 chars) or empty for images
});

export const getRecordsInputSchema = z.object({
  offset: z.number().default(0),
  limit: z.number().default(100),
  searchTerm: z.string().optional(),
});

export const copyRecordInputSchema = z.object({
  id: z.string(),
});

export type ClipboardRecord = z.infer<typeof clipboardRecordSchema>;
export type ClipboardRecordType = z.infer<typeof clipboardRecordTypeSchema>;
export type GetRecordsInput = z.infer<typeof getRecordsInputSchema>;
export type CopyRecordInput = z.infer<typeof copyRecordInputSchema>;
