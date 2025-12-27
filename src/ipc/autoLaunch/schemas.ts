import { z } from "zod";

export const enableAutoLaunchInputSchema = z.object({
  enable: z.boolean(),
});

export type EnableAutoLaunchInput = z.infer<typeof enableAutoLaunchInputSchema>;
