---
'signalium': patch
---

Fix async reactive computations becoming permanently stale when a state write happens during a pending window and the awaited promise resolves to an equal value. `ReactivePromiseImpl._scheduleSubs` used to unconditionally overwrite the consumer's `Dirty` state with `PendingDirty` on equal-value resolution, erasing the `Dirty` set by `StateSignal.notify()` during the pending window. The consumer would then clear pending and become `Clean` without re-running, silently losing the mid-flight state write and detaching from the state signal. The `Dirty` state now survives equal-value resolution so the consumer recomputes as expected.
