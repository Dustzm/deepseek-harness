/** Keep a profile's bundle list in step with the template a launcher ships, across launcher upgrades. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readProfileManifest } from './profile.ts'
import { writeProfileBundles } from './profile-plugins.ts'

/** Profile file recording the template bundle list last applied by {@link syncTemplateBundles}. */
export const TEMPLATE_BUNDLES_RECORD = '.dsh-template-bundles.json'

/**
 * Merge a new template bundle list into a profile's current list.
 *
 * Bundles the template gained since `previous` are inserted after the nearest preceding template bundle the
 * profile has (or before the nearest following one, or at the end); bundles the template dropped are removed.
 * Bundles the user added stay, and template bundles the user removed stay removed. Without a `previous` record
 * (a profile created before records existed), every missing template bundle counts as gained.
 * @param current - The profile's bundle list.
 * @param previous - The template list last applied, or undefined when none was recorded.
 * @param next - The template list now shipped.
 * @returns The merged list; equal to `current` when nothing changed.
 */
export function mergeTemplateBundles(
  current: readonly string[],
  previous: readonly string[] | undefined,
  next: readonly string[],
): string[] {
  const nextSet = new Set(next)
  const dropped = new Set((previous ?? []).filter(bundle => !nextSet.has(bundle)))
  const merged = current.filter(bundle => !dropped.has(bundle))
  const known = new Set(previous ?? [])
  for (const [index, bundle] of next.entries()) {
    if (merged.includes(bundle) || (previous !== undefined && known.has(bundle))) continue
    const before = next.slice(0, index).reverse().find(candidate => merged.includes(candidate))
    if (before !== undefined) {
      merged.splice(merged.indexOf(before) + 1, 0, bundle)
      continue
    }
    const after = next.slice(index + 1).find(candidate => merged.includes(candidate))
    merged.splice(after === undefined ? merged.length : merged.indexOf(after), 0, bundle)
  }
  return merged
}

function readRecord(path: string): string[] | undefined {
  if (!existsSync(path)) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    // A damaged record only loses the removal memory; the merge then treats every missing bundle as gained.
    return undefined
  }
  return Array.isArray(parsed) && parsed.every(bundle => typeof bundle === 'string') ? parsed : undefined
}

/**
 * Apply a launcher's template bundle list to an existing profile and record it for the next upgrade.
 * Call after {@link initProfile}; the caller excludes concurrent profile writes.
 * @param binName - Diagnostic prefix for an invalid profile manifest.
 * @param dir - Profile directory.
 * @param bundles - Template bundle list the launcher ships now.
 * @returns Whether the profile's bundle list changed.
 */
export function syncTemplateBundles(binName: string, dir: string, bundles: readonly string[]): boolean {
  const manifest = readProfileManifest(binName, dir)
  const current = manifest.dsh?.profile?.bundles ?? []
  const recordPath = join(dir, TEMPLATE_BUNDLES_RECORD)
  const merged = mergeTemplateBundles(current, readRecord(recordPath), bundles)
  const changed = merged.length !== current.length || merged.some((bundle, index) => bundle !== current[index])
  if (changed) writeProfileBundles(dir, manifest, merged)
  writeFileSync(recordPath, `${JSON.stringify(bundles, undefined, 2)}\n`, { mode: 0o600 })
  return changed
}
