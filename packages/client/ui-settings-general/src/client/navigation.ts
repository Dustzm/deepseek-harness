/**
 * `ctx.settingsNavigation`: the settings panel's navigation for features
 * outside it (global search, deep links). It exposes the same section rows and
 * nav icons the panel shows and opens the panel on one section.
 */
import type { ComponentType } from 'react'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsSectionRow } from './shell-contract.ts'
import type { SectionIconProps } from './section-icons.tsx'

/** Settings panel navigation. */
export interface SettingsNavigation {
  /** Section rows in nav order; labels follow the active locale. */
  readonly sections: HostObservable<readonly SettingsSectionRow[]>
  /**
   * Open the settings panel on one section, replacing the current section when it is already open.
   * @param id - a registered `settings.section` id.
   * @throws when no section has this id, or before the settings shell is mounted.
   */
  openSection(id: string): void
  /** The nav icon the panel shows for a section: its `settings.section.icon` entry, else the built-in glyph. */
  readonly SectionIcon: ComponentType<SectionIconProps>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Settings panel navigation (client). */
    settingsNavigation: SettingsNavigation
  }
}
