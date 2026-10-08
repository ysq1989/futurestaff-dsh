import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const inject = ['systemPrompt']
export const apply = (ctx: Context, config: { instructions: string }): void => {
  if (typeof config.instructions !== 'string' || Buffer.byteLength(config.instructions) > 65536
    || config.instructions.includes('{{')) throw new Error('ROLE_INSTRUCTIONS_INVALID')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'futurestaff:role', order: 10, text: config.instructions,
  }), 'futurestaff role instructions')
}
