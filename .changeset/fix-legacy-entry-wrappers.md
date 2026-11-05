---
'signalium': patch
---

Fix legacy entry wrapper files crashing under CommonJS resolution and missing type shims in the published package. The root-level wrappers (`react.js`, `react-server.js`, `transform.js`, `debug.js`, `utils.js`, `config.js`) were emitted with CJS syntax (`exports`/`require`) into a package root with `"type": "module"`, causing `ReferenceError: exports is not defined` when loaded via legacy resolution. The sibling `.d.ts` type shims were generated but never added to `files`, so node10-style TypeScript consumers got `TS7016`. Additionally, `react-server.js` re-exported the wrong module (`setupRscRequestScope` instead of the server `component()`).
