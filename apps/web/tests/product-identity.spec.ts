import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { applyClientProductIdentity } from '../product-identity.ts'

/** An output directory holding the copied `public/` identity files. */
async function output() {
  const root = await mkdtemp(join(tmpdir(), 'product-identity-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'manifest.webmanifest'), JSON.stringify({ name: 'Shipped', short_name: 'S', display: 'fullscreen' }))
  await writeFile(join(root, 'favicon.svg'), '<svg>light</svg>')
  await writeFile(join(root, 'favicon-dark.svg'), '<svg>dark</svg>')
  return root
}

it('leaves the shipped manifest and favicons unchanged without identity variables', async () => {
  const root = await output()
  await applyClientProductIdentity(root, {})
  expect(JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'))).toEqual({ name: 'Shipped', short_name: 'S', display: 'fullscreen' })
  expect(await readFile(join(root, 'favicon.svg'), 'utf8')).toBe('<svg>light</svg>')
})

it('sets the manifest names and replaces each favicon from the build variables', async () => {
  const root = await output()
  const icon = join(root, 'icon.svg')
  await writeFile(icon, '<svg>product</svg>')
  await applyClientProductIdentity(root, { DSH_CLIENT_TITLE: 'Product', DSH_CLIENT_SHORT_TITLE: 'P', DSH_CLIENT_ICON_DARK: icon })
  expect(JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'))).toEqual({ name: 'Product', short_name: 'P', display: 'fullscreen' })
  expect(await readFile(join(root, 'favicon-dark.svg'), 'utf8')).toBe('<svg>product</svg>')
  expect(await readFile(join(root, 'favicon.svg'), 'utf8')).toBe('<svg>light</svg>')
})

it('rejects an icon that is not an SVG file', async () => {
  const root = await output()
  await expect(applyClientProductIdentity(root, { DSH_CLIENT_ICON: join(root, 'icon.png') })).rejects.toThrow(/DSH_CLIENT_ICON must name an SVG file/)
})
