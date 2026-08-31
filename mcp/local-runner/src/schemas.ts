import * as z from 'zod/v4'

export const localSystemInfoInputSchema = z.object({}).strict()
export const localSystemInfoOutputSchema = z.object({
  platform: z.string().min(1).max(200),
  arch: z.string().min(1).max(200),
  release: z.string().min(1).max(200),
  hostname: z.string().min(1).max(200),
})

export const localCodexUsageInputSchema = z.object({}).strict()
export const localCodexUsageOutputSchema = z.object({
  source: z.literal('codex-app-server'),
  fetchedAt: z.string().min(1),
  usage: z.object({}).passthrough(),
})

export type LocalSystemInfo = z.infer<typeof localSystemInfoOutputSchema>
export type LocalCodexUsage = z.infer<typeof localCodexUsageOutputSchema>
