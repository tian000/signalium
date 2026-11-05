---
'signalium': patch
---

Fix relay deactivation dropping other watchers during pause/unwatch + recompute flush. `getSignal` and `ReactivePromiseImpl._connect` now take a real watch on a newly-read dep whenever the consumer is still active (`_isActive`), not only when `watchCount > 0`, so a consumer in the unwatched-but-active window either holds the watch (and legitimately releases it in `deactivateSignal`) or never records it.
