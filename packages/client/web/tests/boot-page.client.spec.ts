// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { BootPage } from '../src/boot-page.ts'

afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('meta[name^="dsh-boot-"]').forEach((tag) => { tag.remove() })
})

/** Add the build-time boot metadata a deployment writes into the page head. */
function meta(name: string, content: string): void {
  const tag = document.createElement('meta')
  tag.name = name
  tag.content = content
  document.head.append(tag)
}

function mount() {
  const el = document.createElement('div')
  document.body.append(el)
  return { el, page: new BootPage(el) }
}

describe('BootPage', () => {
  it('draws the loading skeleton before any plugin state arrives', () => {
    const { el } = mount()
    expect(el.firstElementChild?.getAttribute('data-dsh-boot')).toBe('')
    expect(el.textContent).toContain('HARNESS')
    expect(el.textContent).toContain('Loading plugins…')
  })

  it('keeps loading while entries are active or loading', () => {
    const { el, page } = mount()
    page.setTotal(2)
    const spinner = el.querySelector<HTMLElement>('[data-dsh-boot-spinner]')
    expect(spinner?.style.getPropertyValue('--dsh-boot-arc')).toBe('72deg')
    page.setState('a', 'active')
    expect(spinner?.style.getPropertyValue('--dsh-boot-arc')).toBe('180deg')
    page.setState('b', 'loading')
    expect(el.querySelector('[data-dsh-boot-spinner]')).toBe(spinner)
    page.setState('b', 'active')
    expect(spinner?.style.getPropertyValue('--dsh-boot-arc')).toBe('288deg')
    expect(el.textContent).toContain('Loading plugins…')
    expect(el.textContent).not.toContain('Failed to load plugins')
  })

  it('lists failed entries', () => {
    const { el, page } = mount()
    page.setState('@deepseek-ai/dsh-client-ui-layout', 'failed')
    page.setState('ok', 'active')
    page.setState('@deepseek-ai/dsh-client-ui-tool', 'failed')
    expect(el.textContent).toContain('@deepseek-ai/dsh-client-ui-layout')
    expect(el.textContent).toContain('@deepseek-ai/dsh-client-ui-tool')
    expect(el.textContent).not.toContain('ok')
    expect(el.textContent).not.toContain('Loading plugins…')
  })

  it('shows the complete sweep report', () => {
    const { el, page } = mount()
    const report = 'web boot: 1 entry did not activate\nx: pending (waiting for service: y)'
    page.fail(report)
    page.setState('a', 'active')
    expect(el.textContent).toContain(report)
    expect(el.textContent).not.toContain('Loading plugins…')
  })

  it('detaches on disposal', () => {
    const { el, page } = mount()
    page.dispose()
    expect(el.childNodes).toHaveLength(0)
  })

  it('replaces the wordmark and spinner with the configured mark and hides an empty hint', () => {
    meta('dsh-boot-mark', './boot-mark.svg')
    meta('dsh-boot-mark-dark', './boot-mark-dark.svg')
    meta('dsh-boot-hint', '')
    document.title = 'Product'
    const { el, page } = mount()
    const mark = el.querySelector('[data-dsh-boot-mark]')
    expect(mark?.getAttribute('aria-label')).toBe('Product')
    expect([...mark?.querySelectorAll('img') ?? []].map(image => image.getAttribute('src'))).toEqual(['./boot-mark.svg', './boot-mark-dark.svg'])
    expect(el.textContent).not.toContain('HARNESS')
    expect(el.textContent).not.toContain('Loading plugins…')
    expect(el.querySelector('[data-dsh-boot-spinner]')).toBeNull()
    page.setState('x', 'failed')
    expect(el.querySelector('[data-dsh-boot-mark]')).toBe(mark)
    expect(el.textContent).toContain('Failed to load plugins')
  })

  it('uses the light mark for both themes without a dark one, and shows a configured hint', () => {
    meta('dsh-boot-mark', './boot-mark.svg')
    meta('dsh-boot-hint', 'Starting…')
    const { el } = mount()
    expect([...el.querySelectorAll('[data-dsh-boot-mark] img')].map(image => image.getAttribute('src'))).toEqual(['./boot-mark.svg', './boot-mark.svg'])
    expect(el.textContent).toContain('Starting…')
  })
})
