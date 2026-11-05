---
'signalium': patch
---

Fix `component()` reading stale context values after a `ContextProvider`'s value changes. The render signal was bound once at mount to the mount-time `SignalScope` and never rebound when the provider recreated its scope, so `useContext`/`getContext` reads inside `component()` (and async `component()`) permanently returned stale values.
