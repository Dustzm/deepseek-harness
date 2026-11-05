/** Launcher upgrades reach profiles created by earlier versions without overriding user choices. */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initProfile, mergeTemplateBundles, readProfileManifest, syncTemplateBundles, TEMPLATE_BUNDLES_RECORD } from '../src/index.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function profile(bundles: readonly string[]): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'dsh-template-sync-')), 'profiles', 'desktop')
  roots.push(dir)
  initProfile(dir, bundles)
  return dir
}
const bundlesOf = (dir: string) => readProfileManifest('dsh', dir).dsh?.profile?.bundles

describe('mergeTemplateBundles', () => {
  it('inserts gained bundles in template order and removes dropped ones', () => {
    expect(mergeTemplateBundles(['base', 'web', 'user', 'ui'], ['base', 'web', 'ui'], ['base', 'web', 'memory', 'ui', 'tail']))
      .toEqual(['base', 'web', 'memory', 'user', 'ui', 'tail'])
    expect(mergeTemplateBundles(['base', 'old', 'ui'], ['base', 'old', 'ui'], ['base', 'ui'])).toEqual(['base', 'ui'])
  })

  it('keeps user removals and user additions', () => {
    expect(mergeTemplateBundles(['base', 'user'], ['base', 'web'], ['base', 'web'])).toEqual(['base', 'user'])
  })

  it('treats every missing template bundle as gained without a record', () => {
    expect(mergeTemplateBundles(['web', 'user'], undefined, ['head', 'web', 'memory'])).toEqual(['head', 'web', 'memory', 'user'])
    expect(mergeTemplateBundles([], undefined, ['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('syncTemplateBundles', () => {
  it('updates an old profile, records the template, and leaves a current one unchanged', () => {
    const dir = profile(['base', 'ui'])
    expect(syncTemplateBundles('dsh', dir, ['base', 'memory', 'ui'])).toBe(true)
    expect(bundlesOf(dir)).toEqual(['base', 'memory', 'ui'])
    expect(JSON.parse(readFileSync(join(dir, TEMPLATE_BUNDLES_RECORD), 'utf8'))).toEqual(['base', 'memory', 'ui'])
    expect(syncTemplateBundles('dsh', dir, ['base', 'memory', 'ui'])).toBe(false)
  })

  it('does not restore a template bundle the user removed after the last sync', () => {
    const dir = profile(['base', 'memory', 'ui'])
    syncTemplateBundles('dsh', dir, ['base', 'memory', 'ui'])
    const manifest = readProfileManifest('dsh', dir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...manifest, dsh: { profile: { bundles: ['base', 'ui'] } } }))
    expect(syncTemplateBundles('dsh', dir, ['base', 'memory', 'ui'])).toBe(false)
    expect(bundlesOf(dir)).toEqual(['base', 'ui'])
  })

  it('treats an unreadable record as absent', () => {
    for (const record of ['{', '{"a":1}']) {
      const dir = profile(['base'])
      writeFileSync(join(dir, TEMPLATE_BUNDLES_RECORD), record)
      syncTemplateBundles('dsh', dir, ['base', 'memory'])
      expect(bundlesOf(dir)).toEqual(['base', 'memory'])
    }
  })

  it('handles a manifest without a bundle list', () => {
    const dir = profile(['base'])
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', private: true, dependencies: {} }))
    syncTemplateBundles('dsh', dir, ['base'])
    expect(bundlesOf(dir)).toEqual(['base'])
  })
})
