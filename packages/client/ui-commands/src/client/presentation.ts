/** Composer menu sections and the first-party Host command faces this package presents. */
import type { ComponentType } from 'react'
import type { InputTriggerCandidate } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import {
  IconCompactOutlineRegular, IconDownloadOutlineRegular, IconGoalOutlineRegular, IconPaperPlaneOutlineRegular, IconPlanOutlineRegular,
  PermissionIconFullAccessRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'
import type { CommandPresentation, MenuPlacement } from './contract.ts'
import { en, zh } from './locales.ts'

/** One first-party Host command: its definition, glyph, and empty-query position. */
interface BuiltinFace {
  readonly definitionId: string
  readonly icon: ComponentType<IconProps>
  readonly placement: MenuPlacement
}

/** First-party Host commands whose localized face this package registers, by registered name. */
const BUILTINS = {
  goal: { definitionId: '@deepseek-ai/dsh-command-goal', icon: IconGoalOutlineRegular, placement: { section: 'add', rank: 20 } },
  plan: { definitionId: '@deepseek-ai/dsh-plan-mode', icon: IconPlanOutlineRegular, placement: { section: 'add', rank: 30 } },
  feedback: { definitionId: '@deepseek-ai/dsh-command-feedback', icon: IconPaperPlaneOutlineRegular, placement: { section: 'add', rank: 40 } },
  compact: { definitionId: '@deepseek-ai/dsh-command-compact', icon: IconCompactOutlineRegular, placement: { section: 'commands', rank: 10 } },
  permission: { definitionId: '@deepseek-ai/dsh-permission-presets', icon: PermissionIconFullAccessRegular, placement: { section: 'commands', rank: 20 } },
  export: { definitionId: '@deepseek-ai/dsh-session-log-export', icon: IconDownloadOutlineRegular, placement: { section: 'commands', rank: 40 } },
} as const satisfies Record<string, BuiltinFace>

/**
 * The first-party Host command faces, registered through the same
 * `present()` operation third-party packages use. Every locale's token is an
 * alias, so a draft written in either language resolves.
 * @param t - the `command` namespace translator.
 * @returns one presentation per first-party command.
 */
export function builtinPresentations(t: TranslateNS<'command'>): readonly CommandPresentation[] {
  return (Object.keys(BUILTINS) as Array<keyof typeof BUILTINS>).map((name) => {
    const face = BUILTINS[name]
    return {
      definitionId: CommandDefinitionId(face.definitionId),
      label: () => t(`label.${name}`),
      description: () => t(`description.${name}`),
      icon: face.icon,
      token: () => t(`token.${name}`),
      aliases: [zh[`token.${name}`], en[`token.${name}`]],
      placement: face.placement,
    }
  })
}

/**
 * Arrange the empty-query menu: the Add section, then the Commands section,
 * each ascending by placement rank; unplaced rows close Commands in their
 * input order. Each row carries its section heading.
 * @param rows - the visible candidates in catalog-then-contribution order.
 * @param placements - placement per row name.
 * @param t - the `command` namespace translator.
 * @returns the sectioned rows.
 */
export function sectionRows(
  rows: readonly InputTriggerCandidate[],
  placements: ReadonlyMap<string, MenuPlacement>,
  t: TranslateNS<'command'>,
): readonly InputTriggerCandidate[] {
  const placed = (section: MenuPlacement['section']): InputTriggerCandidate[] => rows
    .flatMap((row) => {
      const placement = placements.get(row.name)
      return placement?.section === section ? [{ row, rank: placement.rank }] : []
    })
    // Array.prototype.sort is stable, so equal ranks keep their input order.
    .sort((a, b) => a.rank - b.rank)
    .map(entry => entry.row)
  const add = placed('add').map(row => ({ ...row, section: t('section.add') }))
  const commands = [...placed('commands'), ...rows.filter(row => !placements.has(row.name))]
    .map(row => ({ ...row, section: t('section.commands') }))
  return [...add, ...commands]
}
