/**
 * Load the optional distribution that repackages Desktop under another product.
 *
 * A distribution directory holds `distribution.json` and the files it names:
 * product identity, icons, Windows installer artwork, the client identity embedded in Web artifacts,
 * additional package tarballs, and the profile bundles a new installation
 * starts with. Packaging without a distribution produces DeepSeek Harness.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { valid } from 'semver'

/** Environment variable naming the distribution directory for one packaging run. */
export const DESKTOP_DISTRIBUTION_ENV = 'DSH_DESKTOP_DISTRIBUTION'

/** Packaged manifest field carrying the runtime part of a distribution. */
export const DESKTOP_DISTRIBUTION_MANIFEST_FIELD = 'dshDesktopDistribution'

const DISTRIBUTION_FILE = 'distribution.json'

/** Artwork a `windowsInstaller` directory supplies, named and sized as the shipped `installer/assets` files. */
export const WINDOWS_INSTALLER_IMAGES = ['brand.png', 'brand-2x.png', 'brand-dark.png', 'brand-dark-2x.png', 'uninstaller-sidebar.png']

/** Client build values a distribution may set; file-valued ones resolve against the distribution directory. */
const CLIENT_IDENTITY_FIELDS = {
  DSH_CLIENT_TITLE: 'text',
  DSH_CLIENT_SHORT_TITLE: 'text',
  DSH_CLIENT_ICON: 'file',
  DSH_CLIENT_ICON_DARK: 'file',
  DSH_CLIENT_BOOT_MARK: 'file',
  DSH_CLIENT_BOOT_MARK_DARK: 'file',
  DSH_CLIENT_BOOT_HINT: 'text',
}

const APP_ID_PATTERN = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/u
const PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*$/u
const HOME_DIR_PATTERN = /^\.[A-Za-z0-9][A-Za-z0-9._-]*$/u
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {RegExp | undefined} pattern
 * @param {string} label
 * @returns {string}
 */
function requireString(record, key, pattern, label) {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '' || (pattern !== undefined && !pattern.test(value))) {
    throw new Error(`desktop distribution: ${label}.${key} is missing or invalid`)
  }
  return value
}

/**
 * @param {string} root
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireFile(root, value, label) {
  if (typeof value !== 'string' || value === '' || isAbsolute(value)) {
    throw new Error(`desktop distribution: ${label} must be a path relative to the distribution directory`)
  }
  const path = resolve(root, value)
  if (!path.startsWith(`${root}/`) && !path.startsWith(`${root}\\`)) {
    throw new Error(`desktop distribution: ${label} leaves the distribution directory`)
  }
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`desktop distribution: ${label} ${value} is not a file`)
  return path
}

/**
 * Parse and validate one distribution directory.
 * @param {string} directory - Absolute distribution directory.
 * @returns {import('./desktop-distribution.d.mts').DesktopDistribution} Distribution with absolute file paths.
 */
export function readDesktopDistribution(directory) {
  if (!isAbsolute(directory)) throw new Error(`desktop distribution: ${DESKTOP_DISTRIBUTION_ENV} must be an absolute directory`)
  const root = resolve(directory)
  const file = join(root, DISTRIBUTION_FILE)
  /** @type {unknown} */
  let value
  try {
    value = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`desktop distribution: failed to read ${file}: ${String(error)}`)
  }
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('desktop distribution: schemaVersion must be 1')
  const product = value.product
  if (!isRecord(product)) throw new Error('desktop distribution: product is missing')
  const version = requireString(product, 'version', undefined, 'product')
  if (valid(version) === null) throw new Error(`desktop distribution: product.version ${version} is not a version`)

  const icons = value.icons
  if (!isRecord(icons)) throw new Error('desktop distribution: icons is missing')

  const client = value.client
  if (!isRecord(client)) throw new Error('desktop distribution: client is missing')
  /** @type {Record<string, string>} */
  const clientIdentity = {}
  for (const [name, entry] of Object.entries(client)) {
    const kind = CLIENT_IDENTITY_FIELDS[/** @type {keyof typeof CLIENT_IDENTITY_FIELDS} */ (name)]
    if (kind === undefined) throw new Error(`desktop distribution: client.${name} is not a distribution client value`)
    if (typeof entry !== 'string') throw new Error(`desktop distribution: client.${name} must be a string`)
    clientIdentity[name] = kind === 'file' ? requireFile(root, entry, `client.${name}`) : entry
  }
  if (clientIdentity.DSH_CLIENT_TITLE === undefined) throw new Error('desktop distribution: client.DSH_CLIENT_TITLE is required')

  if (typeof value.packages !== 'string' || value.packages === '' || isAbsolute(value.packages)) {
    throw new Error('desktop distribution: packages must be a directory relative to the distribution directory')
  }
  const packages = resolve(root, value.packages)
  if (!existsSync(packages) || !statSync(packages).isDirectory()
    || !readdirSync(packages).some(name => name.endsWith('.tgz'))) {
    throw new Error(`desktop distribution: packages directory ${value.packages} contains no tarballs`)
  }

  const profile = value.profile
  if (!isRecord(profile) || !Array.isArray(profile.bundles) || profile.bundles.length === 0
    || !profile.bundles.every(bundle => typeof bundle === 'string' && PACKAGE_NAME_PATTERN.test(bundle))
    || new Set(profile.bundles).size !== profile.bundles.length) {
    throw new Error('desktop distribution: profile.bundles must list distinct package names')
  }
  if (typeof value.signIn !== 'boolean') throw new Error('desktop distribution: signIn must be true or false')
  const asarUnpack = value.asarUnpack ?? []
  if (!Array.isArray(asarUnpack) || !asarUnpack.every(pattern => typeof pattern === 'string' && pattern !== '' && !isAbsolute(pattern))) {
    throw new Error('desktop distribution: asarUnpack must list relative glob patterns')
  }
  /** @type {string | undefined} */
  let windowsInstaller
  if (value.windowsInstaller !== undefined) {
    if (typeof value.windowsInstaller !== 'string' || value.windowsInstaller === '' || isAbsolute(value.windowsInstaller)) {
      throw new Error('desktop distribution: windowsInstaller must be a directory relative to the distribution directory')
    }
    windowsInstaller = resolve(root, value.windowsInstaller)
    for (const image of WINDOWS_INSTALLER_IMAGES) requireFile(root, `${value.windowsInstaller}/${image}`, 'windowsInstaller image')
  }
  /** @type {string | undefined} */
  let welcome
  if (value.welcome !== undefined) {
    if (typeof value.welcome !== 'string' || value.welcome === '' || isAbsolute(value.welcome)) {
      throw new Error('desktop distribution: welcome must be a directory relative to the distribution directory')
    }
    welcome = resolve(root, value.welcome)
    requireFile(root, `${value.welcome}/index.html`, 'welcome page')
  }

  return {
    root,
    product: {
      name: requireString(product, 'name', undefined, 'product'),
      fileName: requireString(product, 'fileName', FILE_NAME_PATTERN, 'product'),
      appId: requireString(product, 'appId', APP_ID_PATTERN, 'product'),
      version,
      protocol: requireString(product, 'protocol', PROTOCOL_PATTERN, 'product'),
      homeDirName: requireString(product, 'homeDirName', HOME_DIR_PATTERN, 'product'),
    },
    icons: {
      macos: requireFile(root, icons.macos, 'icons.macos'),
      windows: requireFile(root, icons.windows, 'icons.windows'),
      ...(icons.dmgBackground === undefined ? {} : { dmgBackground: requireFile(root, icons.dmgBackground, 'icons.dmgBackground') }),
      ...(icons.windowsTray === undefined ? {} : { windowsTray: requireFile(root, icons.windowsTray, 'icons.windowsTray') }),
    },
    client: clientIdentity,
    packages,
    profile: { bundles: [...profile.bundles] },
    signIn: value.signIn,
    asarUnpack: [...asarUnpack],
    ...windowsInstaller === undefined ? {} : { windowsInstaller },
    ...welcome === undefined ? {} : { welcome },
  }
}

/**
 * Resolve the distribution one packaging environment selects.
 * @param {NodeJS.ProcessEnv} env - Packaging environment.
 * @returns {import('./desktop-distribution.d.mts').DesktopDistribution | undefined} The distribution, or undefined for DeepSeek Harness.
 */
export function resolveDesktopDistribution(env = process.env) {
  const directory = env[DESKTOP_DISTRIBUTION_ENV]?.trim()
  if (directory === undefined || directory === '') return undefined
  return readDesktopDistribution(directory)
}

/**
 * Project the facts the installed application reads at runtime.
 * @param {import('./desktop-distribution.d.mts').DesktopDistribution} distribution - Validated distribution.
 * @returns {import('../src/distribution.ts').DesktopDistributionMetadata} Packaged manifest value.
 */
export function desktopDistributionMetadata(distribution) {
  return {
    productName: distribution.product.name,
    homeDirName: distribution.product.homeDirName,
    bundles: distribution.profile.bundles,
    signIn: distribution.signIn,
    welcome: distribution.welcome !== undefined,
  }
}
