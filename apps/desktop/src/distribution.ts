/** Runtime facts of the distribution an installed application was packaged as. */

/** Distribution facts sealed into the packaged application manifest. */
export interface DesktopDistributionMetadata {
  /** Product name replacing DeepSeek Harness in shell copy and the About panel. */
  readonly productName: string
  /** Directory under the user's home used as `DSH_HOME` when the variable is unset. */
  readonly homeDirName: string
  /** Bundles a new Desktop profile starts with, replacing the Web template list. */
  readonly bundles: readonly string[]
  /** Whether the welcome flow offers DeepSeek account sign-in. */
  readonly signIn: boolean
  /** Whether the application ships the distribution's welcome page in place of DeepSeek Harness's. */
  readonly welcome: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read the distribution recorded in a packaged application manifest.
 * @param manifest - Parsed application `package.json`.
 * @returns The distribution, or undefined when the application is DeepSeek Harness.
 */
export function desktopDistribution(manifest: unknown): DesktopDistributionMetadata | undefined {
  if (!isRecord(manifest)) throw new Error('desktop distribution: invalid application manifest')
  if (!('dshDesktopDistribution' in manifest)) return undefined
  const value = manifest.dshDesktopDistribution
  if (!isRecord(value) || typeof value.productName !== 'string' || value.productName === ''
    || typeof value.homeDirName !== 'string' || !/^\.[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value.homeDirName)
    || !Array.isArray(value.bundles) || value.bundles.length === 0
    || !value.bundles.every(bundle => typeof bundle === 'string' && bundle !== '')
    || typeof value.signIn !== 'boolean' || typeof value.welcome !== 'boolean') {
    throw new Error('desktop distribution: invalid packaged distribution')
  }
  return {
    productName: value.productName,
    homeDirName: value.homeDirName,
    bundles: value.bundles.filter((bundle): bundle is string => typeof bundle === 'string'),
    signIn: value.signIn,
    welcome: value.welcome,
  }
}
