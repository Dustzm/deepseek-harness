import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  desktopDistributionMetadata,
  readDesktopDistribution,
  resolveDesktopDistribution,
  WINDOWS_INSTALLER_IMAGES,
} from '../scripts/desktop-distribution.mjs'
import { desktopDistribution } from '../src/distribution.ts'
import { resolveDesktopLocale, resolveDesktopStartupLocale } from '../src/locale.ts'
import { writeDistributionFixture } from './fixtures/desktop-distribution.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** Write a valid distribution directory, with `patch` merged over the top-level fields. */
function fixture(patch: Record<string, unknown> = {}): string {
  const root = writeDistributionFixture(patch)
  roots.push(root)
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

  it('replaces the Windows tray icon and installer artwork only with files that exist', () => {
    const root = fixture({ icons: { macos: 'icons/icon.icns', windows: 'icons/icon.png', windowsTray: 'icons/tray.ico' }, windowsInstaller: 'installer' })
    mkdirSync(join(root, 'installer'))
    for (const image of WINDOWS_INSTALLER_IMAGES.slice(1)) writeFileSync(join(root, 'installer', image), '')
    expect(() => readDesktopDistribution(root)).toThrow(/windowsInstaller image installer\/brand\.png/)
    writeFileSync(join(root, 'installer', WINDOWS_INSTALLER_IMAGES[0]), '')
    expect(() => readDesktopDistribution(root)).toThrow(/icons\.windowsTray/)
    writeFileSync(join(root, 'icons/tray.ico'), '')
    const distribution = readDesktopDistribution(root)
    expect(distribution.icons.windowsTray).toBe(join(root, 'icons/tray.ico'))
    expect(distribution.windowsInstaller).toBe(join(root, 'installer'))
    expect(readDesktopDistribution(fixture())).not.toHaveProperty('windowsInstaller')
    expect(() => readDesktopDistribution(fixture({ windowsInstaller: '/abs/installer' }))).toThrow(/windowsInstaller must be a directory/)
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
