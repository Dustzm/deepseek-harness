/** Command identity over the effective Host catalog: exact names, then registered presentation aliases. */
import type { CommandDescriptor } from '@deepseek-ai/dsh-commands/types'
import type { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'

/** Typed spelling → presented definition, built from the live presentation registry. */
export type AliasIndex = ReadonlyMap<string, CommandDefinitionId>

/**
 * Resolve typed spelling against the current Session's effective definitions.
 * @param token - typed name without its leading slash.
 * @param descriptors - effective descriptors in the Session's ready catalog.
 * @param aliases - the registered presentation aliases.
 * @returns the matching descriptor; an alias never selects an unrelated scoped override.
 */
export function resolveCommand(
  token: string,
  descriptors: readonly CommandDescriptor[],
  aliases: AliasIndex,
): CommandDescriptor | undefined {
  const exact = descriptors.find(descriptor => descriptor.name === token)
  if (exact !== undefined) return exact
  const definitionId = aliases.get(token)
  if (definitionId === undefined) return undefined
  return descriptors.find(descriptor => descriptor.definitionId === definitionId)
}
