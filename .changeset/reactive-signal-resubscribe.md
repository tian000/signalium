---
'signalium': patch
---

Fix reactive consumers permanently losing their subscription after a mid-computation dirty of a reactive (derived) dependency followed by a same-pass re-read. The same-pass re-read branch of `getSignal` now re-registers the consumer in the dependency's `subs` map, matching the first-read branch and `StateSignal.consume()`, so a subscription erased by a mid-pass `subs.clear()` is restored.
