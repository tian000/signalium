import { scheduleAsyncPull, schedulePull } from './scheduling.js';
import { ReactiveSignal, isRelay, ReactiveFnState } from './reactive.js';
import { getCurrentConsumer } from './consumer.js';
import { Edge } from './edge.js';

const DIRTY_GUARD_MESSAGE =
  'A signal was dirtied after it was consumed by the current function. This can cause race conditions and infinite rerenders and is not allowed.';

function dirtyGuard(signal: ReactiveSignal<any, any>) {
  if (getCurrentConsumer() === signal) {
    throw new Error(DIRTY_GUARD_MESSAGE);
  }
}

export function dirtySignal(signal: ReactiveSignal<any, any>) {
  const prevState = signal._state;

  if (prevState === ReactiveFnState.Dirty) {
    return;
  }

  // Validate before mutating: the guard must fire before `signal._state` is
  // set to Dirty, otherwise a rejected dirty operation leaves the signal in a
  // half-applied Dirty state that silently no-ops all later dirty attempts.
  if (prevState < ReactiveFnState.MaybeDirty) {
    dirtyGuard(signal);
  }

  signal._state = ReactiveFnState.Dirty;

  if (prevState < ReactiveFnState.MaybeDirty) {
    propagateDirty(signal);
  }
}

function propagateDirty(signal: ReactiveSignal<any, any>) {
  if (isRelay(signal)) {
    if (signal.watchCount > 0) {
      scheduleAsyncPull(signal);
    }

    // else do nothing, only schedule if connected
  } else {
    if (signal._isListener && signal.watchCount > 0) {
      schedulePull(signal);
    }

    // Ensure the subscriber map is always cleared even if dirtySignalConsumers
    // throws partway through, so the fan-out is not left half-applied.
    try {
      dirtySignalConsumers(signal.subs);
    } finally {
      signal.subs.clear();
    }
  }
}

export function dirtySignalConsumers(map: Map<WeakRef<ReactiveSignal<any, any>>, Edge>) {
  let error: unknown;

  for (const [subRef, edge] of map) {
    const sub = subRef.deref();

    if (sub === undefined || sub.computedCount !== edge.consumedAt) continue;

    try {
      const dirtyState = sub._state;

      switch (dirtyState) {
        case ReactiveFnState.Clean:
          // Check the guard before mutating so a rejection does not leave
          // sub._state / sub.dirtyHead / edge.nextDirty half-applied.
          dirtyGuard(sub);
          sub._state = ReactiveFnState.MaybeDirty;
          sub.dirtyHead = edge;
          edge.nextDirty = undefined;
          propagateDirty(sub);
          break;

        case ReactiveFnState.Pending:
        case ReactiveFnState.MaybeDirty:
        case ReactiveFnState.PendingDirty: {
          let subEdge = sub.dirtyHead!;
          const ord = edge.ord;

          if (subEdge.ord > ord) {
            // Only the Pending / PendingDirty branches call propagateDirty, so
            // only those branches need the guard before mutating.
            if (dirtyState === ReactiveFnState.Pending || dirtyState === ReactiveFnState.PendingDirty) {
              dirtyGuard(sub);
            }

            sub.dirtyHead = edge;
            edge.nextDirty = subEdge;

            if (dirtyState === ReactiveFnState.Pending || dirtyState === ReactiveFnState.PendingDirty) {
              // If the signal is pending, the first edge is the halt edge. If the
              // new dirty edge is BEFORE the halt edge, then it means that something
              // changed before the current halt, so we need to cancel the current computation
              // and recompute.
              sub._state = ReactiveFnState.MaybeDirty;
              propagateDirty(sub);
            }
          } else {
            let nextDirty = subEdge.nextDirty;

            while (nextDirty !== undefined && nextDirty.ord < ord) {
              subEdge = nextDirty;
              nextDirty = subEdge.nextDirty;
            }

            if (IS_DEV && edge === nextDirty) {
              throw new Error('Edge already inserted, this should not happen. Please open an issue on GitHub.');
            }

            edge.nextDirty = nextDirty;
            subEdge!.nextDirty = edge;
          }
          break;
        }
      }
    } catch (e) {
      // Catch per-subscriber so a guard violation on one consumer does not
      // truncate the fan-out for the remaining consumers. The first error is
      // saved and rethrown after the loop completes.
      if (error === undefined) {
        error = e;
      }
    }
  }

  if (error !== undefined) {
    throw error;
  }
}
