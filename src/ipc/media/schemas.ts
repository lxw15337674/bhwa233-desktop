import { z } from "zod";

export const convertVideoSchema = z.object({
  inputPath: z.string(),
  format: z.string(),
});

export const getVideoInfoSchema = z.object({
  inputPath: z.string(),
});

export const videoInfoSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  codec: z.string(),
  bitrate: z.number(),
  fps: z.number(),
  size: z.number(),
  format: z.string(),
});

export type VideoInfo = z.infer<typeof videoInfoSchema>;
