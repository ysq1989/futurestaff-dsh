import { z } from 'zod'

export const recipientSchema = z.string().regex(/^[A-Za-z0-9_-]{8,160}$/)
const text = z.string().trim().min(1).max(500)
export const planSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('outbound'),
    recipients: z.array(recipientSchema).min(1).max(50),
    message: text,
    scheduledAt: z.iso.datetime().optional(),
    intervalSeconds: z.number().int().min(30).max(600),
    durationSeconds: z.number().int().min(60).max(3600),
    maxMessages: z.number().int().min(1).max(50),
  }).strict(),
  z.object({
    mode: z.literal('reply'),
    rules: z.array(z.object({ contains: text, reply: text }).strict()).min(1).max(20),
    intervalSeconds: z.number().int().min(30).max(600),
    durationSeconds: z.number().int().min(60).max(3600),
    maxMessages: z.number().int().min(1).max(50),
  }).strict(),
])
export type Plan = z.infer<typeof planSchema>
export const incomingSchema = z.object({
  id: z.string().min(1).max(200), recipient: recipientSchema, text,
}).strict()
export type Incoming = z.infer<typeof incomingSchema>
export interface Adapter {
  check(): Promise<void>
  inbox(): Promise<Incoming[]>
  send(recipient: string, message: string, signal: AbortSignal): Promise<'sent' | 'unknown'>
  close(): void
}
export const stateSchema = z.object({
  version: z.literal(1), owner: z.string(),
  phase: z.enum(['idle', 'draft', 'running', 'paused', 'completed', 'blocked']),
  plan: planSchema.nullable(), previewId: z.string(), expiresAt: z.number(),
  sent: z.number().int().nonnegative(), cursor: z.number().int().nonnegative(),
  nextAt: z.number(), seen: z.array(z.string()),
  ledger: z.record(z.string(), z.enum(['attempting', 'sent', 'unknown'])),
  events: z.array(z.object({ at: z.number(), event: z.string() }).strict()),
}).strict()
export type State = z.infer<typeof stateSchema>
