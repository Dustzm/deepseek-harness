// @vitest-environment jsdom
/**
 * Component override layers through the real SlotRegistry and renderer: the
 * override receives the registered entry's props (injected data, owner props,
 * child-slot rendering), targets address entries per slot kind, layers stack
 * and replace by (source, target), disposal restores the registered component,
 * and plugin unload removes the layer.
 */
import { describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import type { PropsRenderSlots, SlotScopeAdapter, StandardSourceBinding } from '@deepseek-ai/dsh-client-ui-slots'
import * as UiRenderer from '../src/client/index.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'ov.frame': { kind: 'single'; scope: 'root'; owner: { label: string } }
    'ov.leaf': { kind: 'single'; scope: 'root' }
    'ov.rows': { kind: 'list'; scope: 'root' }
    'ov.views': { kind: 'keyed'; scope: 'root' }
    'ov.chain': { kind: 'chain'; scope: 'root'; owner: { label: string } }
  }
}

/** Type-erased registration face: the suite drives runtime semantics with test-only keys. */
interface ErasedSlots {
  register(options: object, component: unknown): () => void
  overrideComponent(source: string, target: object, component: unknown): () => void
}

type FrameSlots = PropsRenderSlots<'ov.leaf' | 'ov.rows' | 'ov.views' | 'ov.chain'>
type FrameProps = FrameSlots & { label: string; greeting: string }

/** Boot the real plugin (its install wires the override table into the renderer) with an empty session scope. */
async function mount() {
  const ctx = new Context()
  await ctx.plugin({ inject: [...UiRenderer.inject], apply: UiRenderer.apply }).await()
  const absent: StandardSourceBinding = { key: undefined, hooks: {}, keyedHooks: {}, props: {} }
  const current = { getSnapshot: () => absent, subscribe: () => () => {} }
  const adapter: SlotScopeAdapter = { current, bindingSource: () => current }
  ctx.slots.installScope('session', adapter)
  const slots = ctx.slots as unknown as ErasedSlots
  slots.register({
    name: 'root',
    children: { 'ov.frame': { kind: 'single', scope: 'root' } },
  }, (props: PropsRenderSlots<'ov.frame'>) => <>{props.renderSlot('ov.frame', { label: 'owner' })}</>)
  slots.register({
    name: 'ov.frame',
    inject: () => ({ greeting: 'injected' }),
    children: {
      'ov.leaf': { kind: 'single', scope: 'root' },
      'ov.rows': { kind: 'list', scope: 'root' },
      'ov.views': { kind: 'keyed', scope: 'root' },
      'ov.chain': { kind: 'chain', scope: 'root' },
    },
  }, (props: FrameProps) => (
    <section data-frame="original">
      {props.greeting}:{props.label}|{props.renderSlot('ov.leaf', {})}
    </section>
  ))
  const container = document.createElement('div')
  document.body.append(container)
  let unmount = () => {}
  await act(async () => { unmount = ctx.get('uiRenderer').mount(container) })
  return { ctx, slots, view: { container }, unmount: () => act(() => { unmount() }) }
}

const Override = (props: FrameProps) => (
  <section data-frame="override">
    {props.greeting}:{props.label}|{props.renderSlot('ov.leaf', {})}|{props.renderSlot('ov.rows', {})}
  </section>
)

describe('slots.overrideComponent', () => {
  it('renders the override with the registered entry\'s injected data, owner props, and child-slot authority', async () => {
    const { slots, view } = await mount()
    await act(async () => {
      slots.register({ name: 'ov.leaf' }, () => <b>leaf</b>)
      slots.register({ name: 'ov.rows', id: 'a' }, () => <i>row</i>)
    })
    expect(view.container.textContent).toBe('injected:owner|leaf')
    let dispose = () => {}
    await act(async () => { dispose = slots.overrideComponent('test', { name: 'ov.frame' }, Override) })
    expect(view.container.querySelector('[data-frame]')?.getAttribute('data-frame')).toBe('override')
    expect(view.container.textContent).toBe('injected:owner|leaf|row')
    await act(async () => { dispose(); dispose() })
    expect(view.container.textContent).toBe('injected:owner|leaf')
  })

  it('stacks layers: the newest matching layer wins, and repeating (source, target) replaces in place', async () => {
    const { slots, view } = await mount()
    const Tag = (tag: string) => () => <b>{tag}</b>
    let disposeA = () => {}
    await act(async () => {
      disposeA = slots.overrideComponent('a', { name: 'ov.frame' }, Tag('a1'))
      slots.overrideComponent('b', { name: 'ov.frame' }, Tag('b'))
    })
    expect(view.container.textContent).toBe('b')
    // Re-adding source a moves its layer to the top.
    await act(async () => { slots.overrideComponent('a', { name: 'ov.frame' }, Tag('a2')) })
    expect(view.container.textContent).toBe('a2')
    // The first disposer for source a no longer owns a live layer.
    await act(async () => { disposeA() })
    expect(view.container.textContent).toBe('a2')
  })

  it('addresses list entries by id, keyed entries by key, and chain entries by registrant', async () => {
    const { slots, view } = await mount()
    await act(async () => {
      slots.register({ name: 'ov.rows', id: 'one', order: 1 }, () => <i>one</i>)
      slots.register({ name: 'ov.rows', id: 'two', order: 2 }, () => <i>two</i>)
      slots.overrideComponent('t', { name: 'ov.frame' }, (props: FrameProps) => <>
        {props.renderSlot('ov.rows', {})}/{props.renderSlot('ov.views', {}, { entryKey: 'k' })}/{props.renderSlotChain('ov.chain', { label: 'c' })}
      </>)
      slots.register({ name: 'ov.views', key: 'k' }, () => <i>view</i>)
      slots.register({ name: 'ov.chain', select: () => true, registrant: 'plugin-a' }, ({ label }: { label: string }) => <i>{label}a</i>)
    })
    expect(view.container.textContent).toBe('onetwo/view/ca')
    await act(async () => {
      slots.overrideComponent('t', { name: 'ov.rows', id: 'two' }, () => <i>TWO</i>)
      slots.overrideComponent('t', { name: 'ov.views', key: 'k' }, () => <i>VIEW</i>)
      slots.overrideComponent('t', { name: 'ov.chain', registrant: 'plugin-a' }, ({ label }: { label: string }) => <i>{label}A</i>)
    })
    expect(view.container.textContent).toBe('oneTWO/VIEW/cA')
  })

  it('rejects an undeclared slot and selectors that do not fit the slot kind', async () => {
    const { slots } = await mount()
    const C = () => null
    expect(() => slots.overrideComponent('t', { name: 'ov.missing' }, C)).toThrow(/not declared/)
    expect(() => slots.overrideComponent('t', { name: 'ov.rows' }, C)).toThrow(/needs "id"/)
    expect(() => slots.overrideComponent('t', { name: 'ov.views', id: 'x' }, C)).toThrow(/needs "key", got "id"/)
    expect(() => slots.overrideComponent('t', { name: 'ov.chain' }, C)).toThrow(/needs "registrant"/)
    expect(() => slots.overrideComponent('t', { name: 'ov.frame', key: 'x' }, C)).toThrow(/needs no selector/)
    expect(() => slots.overrideComponent('t', { name: 'ov.rows', id: 'a', registrant: 'p' }, C)).toThrow(/more than one/)
  })

  it('removes the layer when the overriding plugin unloads (HMR)', async () => {
    const { ctx, view, unmount } = await mount()
    const fiber = ctx.plugin({
      name: 'overrider',
      inject: ['slots'],
      apply(child: Context) {
        ;(child.slots as unknown as ErasedSlots).overrideComponent('overrider', { name: 'ov.frame' }, () => <b>hot</b>)
      },
    })
    await act(async () => { await fiber })
    expect(view.container.textContent).toBe('hot')
    await act(async () => { await fiber.dispose() })
    expect(view.container.textContent).toBe('injected:owner|')
    unmount()
    expect(view.container.textContent).toBe('')
  })
})
