---
'signalium': patch
---

Fix `Promise.*` static methods not being transformed to `ReactivePromise.*` inside `component()` and the `useReactive`/`useReactiveShallow`/`useReactiveDeep` hooks. The promise-methods transform's tracked-import list was missing the React entrypoints, so `Promise.all`/`race`/`any`/`allSettled`/`resolve`/`reject` calls inside those tracked calls were left as native promises, bypassing the reactive await-edge machinery.
