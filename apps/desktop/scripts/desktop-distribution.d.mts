import type { DesktopDistributionMetadata } from '../src/distribution.ts'

/** Product identity a distribution packages Desktop under. */
export interface DesktopDistributionProduct {
  /** Application name: bundle name, menus, About panel and shell copy. */
  readonly name: string
  /** Lowercase ASCII stem of artifact file names. */
  readonly fileName: string
  /** Reverse-DNS application identifier. */
  readonly appId: string
  /** Version the installed application reports; the bundled dsh runtime keeps its own version. */
  readonly version: string
  /** URL scheme registered for deep links. */
  readonly protocol: string
  /** Directory under the user's home used when `DSH_HOME` is unset. */
  readonly homeDirName: string
}

/** Validated distribution with absolute file paths. */
export interface DesktopDistribution {
  readonly root: string
  readonly product: DesktopDistributionProduct
  /** Application icons; `windowsTray` is the Windows notification-area ICO, replacing the shipped tray icon. */
  readonly icons: { readonly macos: string; readonly windows: string; readonly dmgBackground?: string; readonly windowsTray?: string }
  /** `DSH_CLIENT_*` values embedded in the Web client build. */
  readonly client: Readonly<Record<string, string>>
  /** Directory of package tarballs added as roots of the bundled package set. */
  readonly packages: string
  readonly profile: { readonly bundles: readonly string[] }
  /** Whether the welcome flow offers DeepSeek account sign-in. */
  readonly signIn: boolean
  /** Extra glob patterns kept outside `app.asar`, such as executables a bundled package spawns; empty when omitted. */
  readonly asarUnpack: readonly string[]
  /** Directory holding every `WINDOWS_INSTALLER_IMAGES` file, replacing the shipped installer page and uninstaller sidebar artwork. */
  readonly windowsInstaller?: string
  /** Directory whose `index.html` replaces the shipped welcome page, using the same `window.dshWelcome` API. */
  readonly welcome?: string
}

/** Artwork a `windowsInstaller` directory supplies, named and sized as the shipped `installer/assets` files. */
export const WINDOWS_INSTALLER_IMAGES: readonly ['brand.png', 'brand-2x.png', 'brand-dark.png', 'brand-dark-2x.png', 'uninstaller-sidebar.png']

/** Environment variable naming the distribution directory for one packaging run. */
export const DESKTOP_DISTRIBUTION_ENV: 'DSH_DESKTOP_DISTRIBUTION'

/** Packaged manifest field carrying the runtime part of a distribution. */
export const DESKTOP_DISTRIBUTION_MANIFEST_FIELD: 'dshDesktopDistribution'

/**
 * Parse and validate one distribution directory.
 * @param directory - Absolute distribution directory.
 * @returns Distribution with absolute file paths.
 */
export function readDesktopDistribution(directory: string): DesktopDistribution

/**
 * Resolve the distribution one packaging environment selects.
 * @param env - Packaging environment.
 * @returns The distribution, or undefined for DeepSeek Harness.
 */
export function resolveDesktopDistribution(env?: NodeJS.ProcessEnv): DesktopDistribution | undefined

/**
 * Project the facts the installed application reads at runtime.
 * @param distribution - Validated distribution.
 * @returns Packaged manifest value.
 */
export function desktopDistributionMetadata(distribution: DesktopDistribution): DesktopDistributionMetadata
