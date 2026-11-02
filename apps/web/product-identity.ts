/** Public build identity beyond the HTML title: Web manifest names and favicon artwork. */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Favicon files in `public/` and the build variables that replace them, in `index.html` order. */
const CLIENT_ICON_FILES = [['DSH_CLIENT_ICON', 'favicon.svg'], ['DSH_CLIENT_ICON_DARK', 'favicon-dark.svg']] as const

/**
 * Rewrite the copied `public/` identity files in one output directory.
 * `DSH_CLIENT_TITLE` and `DSH_CLIENT_SHORT_TITLE` set the Web manifest `name`
 * and `short_name`; `DSH_CLIENT_ICON` and `DSH_CLIENT_ICON_DARK` name SVG files
 * that replace the light and dark favicons. Unset variables leave the shipped
 * files unchanged.
 * @param outputDirectory - Vite output directory after `public/` was copied.
 * @param environment - build environment carrying the public variables.
 * @throws when an icon variable names a non-SVG or unreadable file.
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
  for (const [variable, file] of CLIENT_ICON_FILES) {
    const source = environment[variable]
    if (source === undefined) continue
    if (!source.endsWith('.svg')) throw new Error(`${variable} must name an SVG file; got ${JSON.stringify(source)}`)
    await writeFile(resolve(outputDirectory, file), await readFile(source))
  }
}

/**
 * Apply the public build identity once Vite has written the bundle and `public/`.
 * @param environment - build environment; the process environment by default.
 * @returns Vite plugin that rewrites the identity files in the written output.
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
    async writeBundle() {
      if (write) await applyClientProductIdentity(outputDirectory, environment)
    },
  }
}
