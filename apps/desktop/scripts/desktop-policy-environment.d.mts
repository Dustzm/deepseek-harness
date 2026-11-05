/** Required deployment-selected metadata for mandatory-update policy requests. */
export interface DesktopPolicyEnvironment {
  origin: string
  allowedPageOrigins: string[]
  allowedAuthOrigins?: string[]
  authentication: 'anonymous' | 'feishu-test'
  [key: string]: unknown
}

/**
 * Decide whether a build carries the mandatory-update policy; unsigned macOS builds and every distribution omit it.
 * @param build Target platform, signing mode, and whether a distribution is packaged.
 * @returns True when packaging must resolve and embed the policy.
 */
export function desktopPolicyRequired(build: { platform: 'win32' | 'darwin', unsigned: boolean, distribution: boolean }): boolean

/**
 * Resolve policy settings before artifact preparation or signing.
 * @param environment File-owned release settings; only the selected origin is required.
 * @returns Policy metadata with deployment-selected origin and authentication.
 */
export function resolveDesktopPolicyEnvironment(environment: NodeJS.ProcessEnv): DesktopPolicyEnvironment
