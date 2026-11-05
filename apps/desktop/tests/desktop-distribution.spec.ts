import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  desktopDistributionMetadata,
  readDesktopDistribution,
  resolveDesktopDistribution,
} from '../scripts/desktop-distribution.mjs'
import { desktopDistribution } from '../src/distribution.ts'
import { resolveDesktopLocale, resolveDesktopStartupLocale } from '../src/locale.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** Write a valid distribution directory, with `patch` merged over the top-level fields. */
function fixture(patch: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'desktop-distribution-'))
  roots.push(root)
  mkdirSync(join(root, 'icons'))
  mkdirSync(join(root, 'client'))
  mkdirSync(join(root, 'packages'))
  for (const file of ['icons/icon.icns', 'icons/icon.png', 'client/mark.svg', 'packages/product-bundle-0.1.0.tgz']) writeFileSync(join(root, file), '')
  writeFileSync(join(root, 'distribution.json'), JSON.stringify({
    schemaVersion: 1,
    product: { name: 'Product', fileName: 'product', appId: 'com.example.product', version: '0.1.0', protocol: 'product', homeDirName: '.product' },
    icons: { macos: 'icons/icon.icns', windows: 'icons/icon.png' },
    client: { DSH_CLIENT_TITLE: 'Product', DSH_CLIENT_ICON: 'client/mark.svg', DSH_CLIENT_BOOT_HINT: '' },
    packages: 'packages',
    profile: { bundles: ['@deepseek-ai/dsh-base', '@product/bundle'] },
    signIn: false,
    ...patch,
  }))
  return root
}

describe('desktop distribution', () => {
  it('is absent unless the packaging environment names a directory', () => {
    expect(resolveDesktopDistribution({})).toBeUndefined()
    expect(resolveDesktopDistribution({ DSH_DESKTOP_DISTRIBUTION: ' ' })).toBeUndefined()
  })

  it('resolves files against the distribution directory and projects the runtime facts', () => {
    const root = fixture()
    const distribution = readDesktopDistribution(root)
    expect(distribution).toMatchObject({
      product: { name: 'Product', appId: 'com.example.product', version: '0.1.0', homeDirName: '.product' },
      icons: { macos: join(root, 'icons/icon.icns'), windows: join(root, 'icons/icon.png') },
      client: { DSH_CLIENT_TITLE: 'Product', DSH_CLIENT_ICON: join(root, 'client/mark.svg'), DSH_CLIENT_BOOT_HINT: '' },
      packages: join(root, 'packages'),
    })
    expect(resolveDesktopDistribution({ DSH_DESKTOP_DISTRIBUTION: root })).toEqual(distribution)
    const metadata = desktopDistributionMetadata(distribution)
    expect(metadata).toEqual({ productName: 'Product', homeDirName: '.product', bundles: ['@deepseek-ai/dsh-base', '@product/bundle'], signIn: false, welcome: false })
    expect(desktopDistribution({ name: 'app', dshDesktopDistribution: metadata })).toEqual(metadata)
    expect(desktopDistribution({ name: 'app' })).toBeUndefined()
  })

  it.each([
    [{ schemaVersion: 2 }, /schemaVersion/],
    [{ product: { name: 'Product' } }, /product\.version/],
    [{ icons: { macos: '../outside.icns', windows: 'icons/icon.png' } }, /leaves the distribution directory/],
    [{ icons: { macos: 'icons/missing.icns', windows: 'icons/icon.png' } }, /is not a file/],
    [{ client: { DSH_CLIENT_VERSION: '9.9.9' } }, /not a distribution client value/],
    [{ client: { DSH_CLIENT_ICON: 'client/mark.svg' } }, /DSH_CLIENT_TITLE is required/],
    [{ profile: { bundles: [] } }, /profile\.bundles/],
    [{ signIn: 'no' }, /signIn/],
    [{ asarUnpack: ['/abs/**'] }, /asarUnpack/],
    [{ asarUnpack: 'vendor/**' }, /asarUnpack/],
  ])('rejects an invalid distribution %#', (patch, message) => {
    expect(() => readDesktopDistribution(fixture(patch))).toThrow(message)
  })

  it('keeps the extra asarUnpack patterns, defaulting to none', () => {
    expect(readDesktopDistribution(fixture()).asarUnpack).toEqual([])
    expect(readDesktopDistribution(fixture({ asarUnpack: ['**/vendor/tool/**/*'] })).asarUnpack).toEqual(['**/vendor/tool/**/*'])
  })

  it('ships a distribution welcome page only when its index.html exists', () => {
    const root = fixture({ welcome: 'welcome' })
    expect(() => readDesktopDistribution(root)).toThrow(/welcome page/)
    mkdirSync(join(root, 'welcome'))
    writeFileSync(join(root, 'welcome/index.html'), '')
    const distribution = readDesktopDistribution(root)
    expect(distribution.welcome).toBe(join(root, 'welcome'))
    expect(desktopDistributionMetadata(distribution).welcome).toBe(true)
  })

  it('rejects a relative directory and a packaged manifest with invalid facts', () => {
    expect(() => readDesktopDistribution('relative')).toThrow(/absolute directory/)
    expect(() => desktopDistribution({ dshDesktopDistribution: { productName: 'Product', homeDirName: 'product', bundles: ['x'], signIn: true, welcome: false } }))
      .toThrow(/invalid packaged distribution/)
  })

  it('names the distribution product throughout the shell copy', () => {
    const branded = resolveDesktopLocale('zh-CN', '通办')
    expect(branded.messages.quitApplication).toBe('退出通办')
    expect(branded.messages.quitTitle).toBe('退出通办？')
    expect(resolveDesktopLocale('en', '通办').messages.quitApplication).toBe('Quit 通办')
    expect(Object.values(branded.messages).some(message => message.includes('DeepSeek Harness'))).toBe(false)
    expect(resolveDesktopStartupLocale(null, ['en-US'], 'Product').messages.aboutMenu).toBe('About Product')
    expect(resolveDesktopLocale('en').messages.aboutMenu).toBe('About DeepSeek Harness')
  })
})
