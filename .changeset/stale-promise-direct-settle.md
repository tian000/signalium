---
'signalium': patch
---

Fix a stale in-flight `setPromise` continuation overwriting a direct `state.value`/`state.setError` write. Direct settles now increment a settle-generation counter that `_setPromise` captures and checks after `await`, so a late-resolving promise from before the direct settle is suppressed instead of clobbering the newer value/error and spurious re-notifying consumers.
