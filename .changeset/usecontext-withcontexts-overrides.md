---
'signalium': patch
---

Fix `useContext` (from `signalium/react`) ignoring `withContexts` overrides. `useContext` now consults the dynamic `CURRENT_SCOPE` first (via `getInternalCurrentScope()`), matching the resolution order already used by `getContext` and `getCurrentScope`. Previously it read only the reactive consumer's scope or the `useScope()` React hook fallback, so `withContexts` overrides were invisible and the parent/default value was returned instead.
