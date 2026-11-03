/** Effect-bound presentation claims held by client plugins. */
import type { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** Counts live claims; `held` is true while at least one claim is live. */
export class EffectClaims {
  private count = 0
  private readonly store = createSnapshotStore<boolean>(false)

  /** Whether any claim is live. */
  get held(): ObservableSnapshot<boolean> {
    return this.store
  }

  /**
   * Take one claim for the lifetime of the calling fiber.
   * @param ctx - fiber that owns the claim.
   * @param label - effect label for inspection.
   * @returns idempotent release.
   */
  claim(ctx: Context, label: string): () => void {
    const dispose = ctx.effect(() => {
      this.count += 1
      this.store.set(true)
      return () => {
        this.count -= 1
        if (this.count === 0) this.store.set(false)
      }
    }, label)
    return () => { void dispose() }
  }
}
