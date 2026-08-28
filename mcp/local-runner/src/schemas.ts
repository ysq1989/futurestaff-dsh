import * as z from 'zod/v4'

export const localSystemInfoInputSchema = z.object({}).strict()
export const localSystemInfoOutputSchema = z.object({
  platform: z.string().min(1).max(200),
  arch: z.string().min(1).max(200),
  release: z.string().min(1).max(200),
  hostname: z.string().min(1).max(200),
})

export type LocalSystemInfo = z.infer<typeof localSystemInfoOutputSchema>
