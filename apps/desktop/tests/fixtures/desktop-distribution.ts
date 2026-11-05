/** Distribution directories for packaging tests. */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Write a valid distribution directory in a new temporary directory; the caller removes it.
 * @param patch - Top-level `distribution.json` fields merged over the valid defaults.
 * @returns Absolute distribution directory.
 */
export function writeDistributionFixture(patch: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'desktop-distribution-'))
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
