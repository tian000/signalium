---
'signalium': patch
---

Fix silent missed updates when the dirty guard throws during async reactive writes. The "dirtied after it was consumed" guard in `propagateDirty` threw after `signal._state` had already been set to `Dirty`, and the throw escaped `StateSignal.notify()`'s subscriber loop mid-iteration. This left the offending signal half-applied in `Dirty` state (silently no-op'ing later dirty attempts) and truncated the fan-out so subscribers appearing later in the map missed the update entirely, with `_subs.clear()` and `scheduleListeners()` skipped. The guard now runs before any mutation, `notify()` and `dirtySignalConsumers` catch per-subscriber so the fan-out always completes, and `signal.subs.clear()` runs in a `finally`.
