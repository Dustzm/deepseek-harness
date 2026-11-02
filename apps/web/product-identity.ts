/** Public build identity beyond the HTML title: Web manifest names, favicon artwork, and the boot page brand. */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Favicon files in `public/` and the build variables that replace them, in `index.html` order. */
const CLIENT_ICON_FILES = [['DSH_CLIENT_ICON', 'favicon.svg'], ['DSH_CLIENT_ICON_DARK', 'favicon-dark.svg']] as const

/** Boot page marks written beside `index.html`, with the variable naming each source and the metadata naming each file. */
const BOOT_MARK_FILES = [
  ['DSH_CLIENT_BOOT_MARK', 'boot-mark.svg', 'dsh-boot-mark'],
  ['DSH_CLIENT_BOOT_MARK_DARK', 'boot-mark-dark.svg', 'dsh-boot-mark-dark'],
] as const

/** Escape build-time text before placing it in an HTML attribute. */
function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Copy one build-variable SVG into the output directory. */
async function copySvg(variable: string, source: string, target: string): Promise<void> {
  if (!source.endsWith('.svg')) throw new Error(`${variable} must name an SVG file; got ${JSON.stringify(source)}`)
  await writeFile(target, await readFile(source))
}

/**
 * Boot page metadata for the initial HTML: `DSH_CLIENT_BOOT_MARK` and
 * `DSH_CLIENT_BOOT_MARK_DARK` name the marks that replace the boot wordmark and
 * spinner, and `DSH_CLIENT_BOOT_HINT` replaces the loading hint (empty hides it).
 * @param environment - build environment carrying the public variables.
 * @returns `<meta>` tags to place in the document head; empty without boot variables.
 */
export function bootPageMetadata(environment: NodeJS.ProcessEnv): string {
  const tags: string[] = []
  for (const [variable, file, name] of BOOT_MARK_FILES) {
    if (environment[variable] !== undefined) tags.push(`<meta name="${name}" content="./${file}" />`)
  }
  const hint = environment.DSH_CLIENT_BOOT_HINT
  if (hint !== undefined) tags.push(`<meta name="dsh-boot-hint" content="${escapeHtmlAttribute(hint)}" />`)
  return tags.join('\n    ')
}

/**
 * Rewrite the copied `public/` identity files in one output directory.
 * `DSH_CLIENT_TITLE` and `DSH_CLIENT_SHORT_TITLE` set the Web manifest `name`
 * and `short_name`; `DSH_CLIENT_ICON` and `DSH_CLIENT_ICON_DARK` name SVG files
 * that replace the light and dark favicons; `DSH_CLIENT_BOOT_MARK` and
 * `DSH_CLIENT_BOOT_MARK_DARK` name SVG files written as the boot page marks.
 * Unset variables leave the shipped files unchanged.
 * @param outputDirectory - Vite output directory after `public/` was copied.
 * @param environment - build environment carrying the public variables.
 * @throws when an icon or mark variable names a non-SVG or unreadable file.
 */
export async function applyClientProductIdentity(outputDirectory: string, environment: NodeJS.ProcessEnv): Promise<void> {
  const name = environment.DSH_CLIENT_TITLE
  const shortName = environment.DSH_CLIENT_SHORT_TITLE
  if (name !== undefined || shortName !== undefined) {
    const path = resolve(outputDirectory, 'manifest.webmanifest')
    const manifest = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
    await writeFile(path, `${JSON.stringify({
      ...manifest,
      ...(name === undefined ? {} : { name }),
      ...(shortName === undefined ? {} : { short_name: shortName }),
    }, null, 2)}\n`)
  }
  for (const [variable, file] of [...CLIENT_ICON_FILES, ...BOOT_MARK_FILES]) {
    const source = environment[variable]
    if (source !== undefined) await copySvg(variable, source, resolve(outputDirectory, file))
  }
}

/**
 * Apply the public build identity: boot metadata in the initial HTML, then the
 * identity files once Vite has written the bundle and `public/`.
 * @param environment - build environment; the process environment by default.
 * @returns Vite plugin that injects the metadata and rewrites the written identity files.
 */
export function clientProductIdentity(environment: NodeJS.ProcessEnv = process.env): Plugin {
  let write = true
  let outputDirectory = ''
  return {
    name: 'dsh-client-product-identity',
    configResolved(config) {
      write = config.build.write
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      const metadata = bootPageMetadata(environment)
      return metadata === '' ? html : html.replace('</head>', `  ${metadata}\n  </head>`)
    },
    async writeBundle() {
      if (write) await applyClientProductIdentity(outputDirectory, environment)
    },
  }
}
