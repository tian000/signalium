---
'signalium': patch
---

Fix the scheduler permanently wedging when a watched derived signal's compute, a listener callback, or a deactivation throws during a flush. `flushWatchers` now wraps its body in `try`/`finally` so `currentFlush` is always released and the flush promise always settles, and the `runBatch` section clears its pending queues in a `finally` so a throwing listener can no longer poison the queue.
