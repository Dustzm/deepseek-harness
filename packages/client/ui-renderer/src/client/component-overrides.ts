/**
 * Component override layers: replace the component one registered Slot entry
 * renders while the entry itself stays registered. The entry keeps its
 * injected data, store instance, standard props, `t` seat, and the child-slot
 * declarations that authorize its `renderSlot`, so an override component
 * receives exactly the props the original would have received.
 *
 * Layers are keyed by `source` and target: calling again with the same pair
 * replaces that layer in place, and the most recently added layer that matches
 * an entry wins. Removing a layer restores the next matching layer or the
 * registered component.
 */
import type { SlotEntryDef, SlotMap, SlotSpec, StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'

/** Kind of the slot `K` as declared in SlotMap. */
type SlotKindOf<K extends keyof SlotMap & string> = SlotMap[K] extends { kind: infer Kind } ? Kind : never

/**
 * One entry to override, located the way the slot kind addresses its entries:
 * a single slot by name alone (whichever entry renders there), a keyed slot by
 * `key`, a list slot by `id`. Chain entries carry no identity of their own, so
 * every kind also accepts `registrant`: the registering plugin's name as the
 * registry stamped it.
 */
export type SlotOverrideTarget<K extends keyof SlotMap & string> =
  | { readonly name: K; readonly registrant: string }
  | (SlotKindOf<K> extends 'single' ? { readonly name: K }
    : SlotKindOf<K> extends 'keyed' ? { readonly name: K; readonly key: string }
      : SlotKindOf<K> extends 'list' ? { readonly name: K; readonly id: string }
        : never)

/** Type-erased target view used at runtime. */
interface ErasedTarget {
  readonly name: string
  readonly key?: string
  readonly id?: string
  readonly registrant?: string
}

interface Layer {
  readonly source: string
  readonly target: ErasedTarget
  readonly component: unknown
}

/** Stable identity of one (source, target) layer. */
function layerId(source: string, target: ErasedTarget): string {
  return JSON.stringify([source, target.name, target.key ?? null, target.id ?? null, target.registrant ?? null])
}

/**
 * Check a target against the declared slot kind; a selector the kind cannot
 * address would silently never match.
 * @param target - requested target.
 * @param spec - declaration of `target.name`, when declared.
 * @throws when the slot is undeclared or the selector does not fit its kind.
 */
export function validateOverrideTarget(target: ErasedTarget, spec: SlotSpec<SlotEntryDef> | undefined): void {
  if (spec === undefined) {
    throw new Error(`slot "${target.name}" is not declared; override it from slots.inject("${target.name}", …)`)
  }
  const selectors = [target.key, target.id, target.registrant].filter(value => value !== undefined)
  if (selectors.length > 1) throw new Error(`override of "${target.name}" names more than one of key, id, registrant`)
  if (target.registrant !== undefined) return
  const expected = spec.kind === 'keyed' ? 'key' : spec.kind === 'list' ? 'id' : spec.kind === 'chain' ? 'registrant' : undefined
  const given = target.key !== undefined ? 'key' : target.id !== undefined ? 'id' : undefined
  if (expected !== given) {
    const want = expected === undefined ? 'no selector' : `"${expected}"`
    throw new Error(`override of ${spec.kind} slot "${target.name}" needs ${want}${given === undefined ? '' : `, got "${given}"`}`)
  }
}

/** Whether a layer's target addresses this entry of `slotKey`. */
function matches(target: ErasedTarget, slotKey: string, entry: StoredEntry): boolean {
  if (target.name !== slotKey) return false
  if (target.registrant !== undefined) return entry.registrant === target.registrant
  if (target.key !== undefined) return entry.options.key === target.key
  if (target.id !== undefined) return entry.options.id === target.id
  return true
}

/** The override layers of one SlotRegistry, observable by the renderer. */
export class ComponentOverrideTable {
  private layers: readonly Layer[] = []
  private revision = 0
  private readonly listeners = new Set<() => void>()

  /**
   * Add or replace the layer for `(source, target)`.
   * @param source - layer owner, e.g. a package name.
   * @param target - entry to override; already validated by the caller.
   * @param component - component rendered in place of the registered one.
   * @returns idempotent disposer removing exactly this layer.
   */
  add(source: string, target: ErasedTarget, component: unknown): () => void {
    const id = layerId(source, target)
    const layer: Layer = { source, target, component }
    this.layers = [...this.layers.filter(existing => layerId(existing.source, existing.target) !== id), layer]
    this.publish()
    return () => {
      if (!this.layers.includes(layer)) return
      this.layers = this.layers.filter(existing => existing !== layer)
      this.publish()
    }
  }

  /**
   * The component to render for one entry.
   * @param slotKey - slot the entry renders in.
   * @param entry - stored registration.
   * @returns the newest matching override, or the registered component.
   */
  componentOf(slotKey: string, entry: StoredEntry): unknown {
    const layer = this.layers.findLast(candidate => matches(candidate.target, slotKey, entry))
    return layer === undefined ? entry.component : layer.component
  }

  /** @returns a counter that changes whenever a layer is added, replaced, or removed. */
  getRevision = (): number => this.revision

  /**
   * @param listener - called after each layer change.
   * @returns unsubscribe.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(): void {
    this.revision += 1
    for (const listener of [...this.listeners]) listener()
  }
}
