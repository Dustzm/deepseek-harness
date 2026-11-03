/** Client-side presentation choices other plugins make for the composer permission seat. */
import { Service, type Context } from '@deepseek-ai/cordis'
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/**
 * Effect-bound claims over how the composer permission seat renders. As a
 * Cordis service, each claim's effect belongs to the calling plugin's fiber.
 */
export class PermissionPresentation extends Service {
  private childClaims = 0
  private readonly childHidden = createSnapshotStore<boolean>(false)

  /**
   * @param ctx - owning client context.
   */
  constructor(ctx: Context) {
    super(ctx, 'uiPermission')
  }

  /** Whether delegated child sessions omit the seat; `true` while any claim from `hideInChildSessions()` is held. */
  get hiddenInChildSessions(): ObservableSnapshot<boolean> {
    return this.childHidden
  }

  /**
   * Omit the composer permission seat in delegated child sessions (subagents
   * and team members, whose permissions their parent set when creating them)
   * for the caller's lifetime. Top-level sessions keep the seat.
   * @returns idempotent release.
   */
  hideInChildSessions(): () => void {
    const dispose = this.ctx.effect(() => {
      this.childClaims += 1
      this.childHidden.set(true)
      return () => {
        this.childClaims -= 1
        if (this.childClaims === 0) this.childHidden.set(false)
      }
    }, 'uiPermission.hideInChildSessions')
    return () => { void dispose() }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Presentation choices for the composer permission seat. */
    uiPermission: PermissionPresentation
  }
}
