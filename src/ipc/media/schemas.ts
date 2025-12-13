import { z } from "zod";

export const convertVideoSchema = z.object({
  inputPath: z.string(),
  format: z.string(),
});
