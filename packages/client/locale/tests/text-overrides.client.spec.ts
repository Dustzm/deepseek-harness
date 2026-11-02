// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { LocaleSnapshot } from '@deepseek-ai/dsh-client-locale/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'spec.overrides': 'title' | 'body'
  }
}

const NS = 'spec.overrides'

const make = (): { svc: LocaleRuntime; events: LocaleSnapshot[] } => {
  const ctx = new Context()
  const events: LocaleSnapshot[] = []
  ctx.on('locale/change', (snapshot) => { events.push(snapshot) })
  const svc = new LocaleRuntime(ctx)
  svc.register(NS, { zh: { title: '新会话', body: '正文' }, en: { title: 'New chat', body: 'Body' } })
  return { svc, events }
}

describe('LocaleRuntime.overrideTexts', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'], language: 'zh-CN' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('replaces only the named keys in the named locale', () => {
    const { svc } = make()
    const t = svc.bind(NS)
    svc.overrideTexts('brand', { [NS]: { zh: { title: '新任务' } } })
    expect(t('title')).toBe('新任务')
    expect(t('body')).toBe('正文')
    svc.setLocale('en')
    expect(t('title')).toBe('New chat')
  })

  it('answers each fallback step before that step\'s dictionary', () => {
    const { svc } = make()
    svc.addLanguage({ id: 'zh-x-brand', label: '品牌中文', fallback: 'zh' })
    svc.setLocale('zh-x-brand')
    svc.overrideTexts('brand', { [NS]: { zh: { title: '新任务' } } })
    // zh-x-brand has no dictionary; the zh step answers from the override.
    expect(svc.bind(NS)('title')).toBe('新任务')
  })

  it('covers keys that consumers resolve through the common vocabulary', () => {
    const { svc } = make()
    svc.register('common', 'zh', { cancel: '取消' })
    svc.overrideTexts('brand', { common: { zh: { cancel: '先不了' } } })
    expect(svc.bind(NS)('cancel')).toBe('先不了')
  })

  it('applies a layer registered before its dictionary', () => {
    const ctx = new Context()
    const svc = new LocaleRuntime(ctx)
    svc.overrideTexts('brand', { [NS]: { zh: { title: '新任务' } } })
    svc.register(NS, { zh: { title: '新会话', body: '正文' }, en: { title: 'New chat', body: 'Body' } })
    expect(svc.bind(NS)('title')).toBe('新任务')
    expect(svc.bind(NS)('body')).toBe('正文')
  })

  it('stacks layers: later sources win per key, and re-overriding restacks a source on top', () => {
    const { svc } = make()
    const t = svc.bind(NS)
    svc.overrideTexts('a', { [NS]: { zh: { title: 'A 标题', body: 'A 正文' } } })
    svc.overrideTexts('b', { [NS]: { zh: { title: 'B 标题' } } })
    expect(t('title')).toBe('B 标题')
    expect(t('body')).toBe('A 正文')
    svc.overrideTexts('a', { [NS]: { zh: { title: 'A2 标题' } } })
    expect(t('title')).toBe('A2 标题')
    // The replaced layer for `a` no longer names `body`.
    expect(t('body')).toBe('正文')
  })

  it('disposes exactly its own layer, and a stale disposer leaves the newer layer alone', () => {
    const { svc } = make()
    const t = svc.bind(NS)
    const disposeFirst = svc.overrideTexts('brand', { [NS]: { zh: { title: '一' } } })
    const disposeSecond = svc.overrideTexts('brand', { [NS]: { zh: { title: '二' } } })
    disposeFirst()
    expect(t('title')).toBe('二')
    disposeSecond()
    expect(t('title')).toBe('新会话')
    disposeSecond()
    expect(t('title')).toBe('新会话')
  })

  it('refreshes rendered outlets through the revision without emitting locale/change', () => {
    const { svc, events } = make()
    const seen: number[] = []
    svc.subscribe(() => { seen.push(svc.getSnapshot().revision) })
    const before = svc.getSnapshot().revision
    const dispose = svc.overrideTexts('brand', { [NS]: { zh: { title: '新任务' } } })
    dispose()
    expect(seen).toEqual([before + 1, before + 2])
    expect(events).toEqual([])
  })

  it('detaches the layer from later mutation of the caller input', () => {
    const { svc } = make()
    const texts = { title: '新任务' }
    svc.overrideTexts('brand', { [NS]: { zh: texts } })
    texts.title = '被改动'
    expect(svc.bind(NS)('title')).toBe('新任务')
  })

  it('rejects a malformed locale tag and names the source', () => {
    const { svc } = make()
    expect(() => svc.overrideTexts('brand', { [NS]: { 'not a tag': { title: 'x' } } }))
      .toThrow('text override "brand": locale id "not a tag"')
    expect(svc.bind(NS)('title')).toBe('新会话')
  })
})
