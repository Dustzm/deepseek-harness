/**
 * Framework-free boot page and failure report. It remains available when a
 * client plugin fails because React arrives only with the UI renderer.
 * @module @deepseek-ai/dsh-client-web/src/boot-page
 */
import type { LoaderEntryState } from './loader-status.ts'
import css from './boot-page.module.css'

/**
 * Page metadata a deployment sets at build time to brand the boot page:
 * `dsh-boot-mark` / `dsh-boot-mark-dark` name images that replace the
 * wordmark and spinner (the image animates itself), and `dsh-boot-hint`
 * replaces the loading hint; an empty hint hides it.
 */
const BOOT_META = { mark: 'dsh-boot-mark', markDark: 'dsh-boot-mark-dark', hint: 'dsh-boot-hint' } as const

/** Read one boot-page metadata value; absent when the page carries no such tag. */
function bootMeta(name: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content
}

/** Create a div with one module class and optional text. */
function div(className: string | undefined, text?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className ?? ''
  if (text !== undefined) el.textContent = text
  return el
}

/** Kernel-owned page mounted below the application's root element. */
export class BootPage {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  /** Brand header: the configured mark, or the built-in wordmark. */
  private readonly wordmark: HTMLDivElement
  private readonly spinner: HTMLDivElement
  /** Loading content below the header while nothing failed. */
  private readonly loading: readonly HTMLDivElement[]
  private readonly states = new Map<string, LoaderEntryState>()
  private readonly active = new Set<string>()
  private total = 0
  private failure: string | undefined

  /**
   * Build and attach the boot page.
   * @param container - Application mount point.
   */
  constructor(container: HTMLElement) {
    this.root = div(css.boot)
    this.root.dataset.dshBoot = ''
    this.card = div(css.card)
    const mark = bootMeta(BOOT_META.mark)
    this.wordmark = mark === undefined ? div(css.wordmark, 'HARNESS') : bootMark(mark, bootMeta(BOOT_META.markDark) ?? mark)
    this.spinner = div(css.spinner)
    this.spinner.dataset.dshBootSpinner = ''
    const hintText = bootMeta(BOOT_META.hint) ?? 'Loading plugins…'
    const hint = hintText === '' ? [] : [div(css.hint, hintText)]
    // A configured mark carries its own animation, so it replaces the spinner.
    this.loading = mark === undefined ? [this.spinner, ...hint] : hint
    this.card.append(this.wordmark, ...this.loading)
    this.root.append(this.card)
    container.append(this.root)
    this.updateProgress()
  }

  /**
   * Set the number of loader entries represented by the progress arc.
   * @param total - Complete boot roster size.
   */
  setTotal(total: number): void {
    this.total = total
    this.updateProgress()
  }

  /**
   * Project one loader entry's fiber state.
   * @param id - Loader entry name.
   * @param state - Projected fiber state.
   */
  setState(id: string, state: LoaderEntryState): void {
    this.states.set(id, state)
    if (state === 'active') this.active.add(id)
    this.updateProgress()
    this.render()
  }

  /**
   * Display the boot failure report.
   * @param message - Failure report text.
   */
  fail(message: string): void {
    this.failure = message
    this.render()
  }

  /** Detach the page before or after the UI renderer takes the mount point. */
  dispose(): void {
    this.root.remove()
  }

  /** Redraw the state-dependent content below the wordmark. */
  private render(): void {
    const failed = [...this.states].filter(([, state]) => state === 'failed').map(([id]) => id)
    if (this.failure === undefined && failed.length === 0) {
      if (this.card.lastElementChild !== (this.loading.at(-1) ?? this.wordmark)) {
        this.card.replaceChildren(this.wordmark, ...this.loading)
      }
      return
    }
    const report = div(css.failed)
    report.append(div(css.failedTitle, 'Failed to load plugins'))
    for (const id of failed) report.append(div(css.failedItem, id))
    if (this.failure !== undefined) report.append(div(css.failedItem, this.failure))
    this.card.replaceChildren(this.wordmark, report)
  }

  /** Grow the rotating arc monotonically as loader entries activate. */
  private updateProgress(): void {
    const ratio = this.total === 0 ? 0 : Math.min(this.active.size / this.total, 1)
    this.spinner.style.setProperty('--dsh-boot-arc', `${String(Math.round(72 + ratio * 216))}deg`)
  }
}

/**
 * Build the configured brand mark: one image per theme, switched by the same
 * dark-theme marker the boot page colors follow. The page title names it.
 * @param light - image URL for the light theme.
 * @param dark - image URL for the dark theme.
 * @returns the mark element.
 */
function bootMark(light: string, dark: string): HTMLDivElement {
  const mark = div(css.mark)
  mark.dataset.dshBootMark = ''
  mark.setAttribute('role', 'img')
  mark.setAttribute('aria-label', document.title)
  for (const [src, className] of [[light, css.markLight], [dark, css.markDark]] as const) {
    const image = document.createElement('img')
    image.src = src
    image.alt = ''
    image.className = className ?? ''
    mark.append(image)
  }
  return mark
}
