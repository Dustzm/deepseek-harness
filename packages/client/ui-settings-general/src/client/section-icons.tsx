/**
 * Settings navigation glyphs shared by the shell's nav rail and
 * `ctx.settingsNavigation.SectionIcon`: a section shows its
 * `settings.section.icon` entry, otherwise the shell's built-in glyph.
 */
import { createElement, useSyncExternalStore, type ComponentType, type ReactElement } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsSectionIconOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  IconAgentPresetOutlineMedium, IconArchiveOutlineMedium, IconDataOutlineMedium,
  IconPersonalizationOutlineMedium, IconSettingsOutlineMedium, IconUserOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Built-in nav glyph by section id; unknown ids fall back to the settings gear.
 * @param id - section id.
 * @param props - the shell's icon class and pixel size.
 * @returns the glyph element.
 */
export function builtinSectionIcon(id: string, { className, size }: SettingsSectionIconOwnerProps): ReactElement {
  if (id === 'account') return <IconUserOutlineMedium className={className} size={size} />
  if (id === 'models') return <IconDataOutlineMedium className={className} size={size} />
  if (id === 'agent-presets') return <IconAgentPresetOutlineMedium className={className} size={size} />
  if (id === 'plugins') return <IconPersonalizationOutlineMedium className={className} size={size} />
  if (id === 'archived-sessions') return <IconArchiveOutlineMedium className={className} size={size} />
  return <IconSettingsOutlineMedium className={className} size={size} />
}

/** Props of {@link createSectionIcon}'s component. */
export interface SectionIconProps extends SettingsSectionIconOwnerProps {
  /** Section id the icon belongs to. */
  readonly id: string
}

/**
 * Build the component that draws a section's nav icon outside the shell. A
 * registered `settings.section.icon` component receives only its owner props
 * (`className`, `size`); registrants that read standard seats such as `t` are
 * drawn with the built-in glyph instead of failing.
 * @param ctx - client context whose slot ledger holds the icon entries.
 * @returns a component that follows ledger changes.
 */
export function createSectionIcon(ctx: ClientContext): ComponentType<SectionIconProps> {
  // The root slot ledger outlives this plugin's fiber: a mounted icon may still
  // re-render while the plugin unloads and its ledger entries are withdrawn.
  const slots = ctx.slots
  const subscribe = (listener: () => void) => slots.subscribe('settings.section.icon', listener)
  const version = () => slots.getVersion('settings.section.icon')
  return function SectionIcon({ id, className, size }: SectionIconProps) {
    useSyncExternalStore(subscribe, version)
    const entry = slots.entriesOfSlot('settings.section.icon').find(item => item.options.key === id)
    if (entry === undefined || entry.locale !== undefined) return builtinSectionIcon(id, { className, size })
    return createElement(entry.component as ComponentType<SettingsSectionIconOwnerProps>, { className, size })
  }
}
