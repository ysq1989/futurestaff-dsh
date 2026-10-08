export const platformEnvironments = Object.freeze({
  dev: 'https://dev.fsstory.net',
  production: 'https://platform.fsstory.net',
})
export type PlatformEnvironment = keyof typeof platformEnvironments
export function platformOrigin(environment: PlatformEnvironment = 'dev'): string {
  if (!Object.hasOwn(platformEnvironments, environment)) throw new Error('PLATFORM_ENVIRONMENT_INVALID')
  return platformEnvironments[environment]
}
export function assertPlatformOrigin(raw: string): string {
  const url = new URL(raw)
  if (!Object.values(platformEnvironments).some(origin => origin === url.origin) || url.href !== `${url.origin}/`)
    throw new Error('PLATFORM_ORIGIN_INVALID')
  return url.origin
}
