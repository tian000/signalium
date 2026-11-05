---
'signalium': patch
---

Restore `CURRENT_CALLBACK` across `await` boundaries in async nested callbacks. `generatorResultToPromiseWithScope` now threads the owning `Callback` and re-establishes it on each generator step, mirroring the existing `savedConsumer` pattern. This prevents function expressions evaluated after an `await` inside an async nested callback from throwing `callback must be used within a reactive function, component, or nested callback` when invoked outside a reactive consumer, and fixes the associated wrong-consumer callback-cache registration hazard.
