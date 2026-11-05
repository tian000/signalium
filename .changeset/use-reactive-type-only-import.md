---
'signalium': patch
---

Fix the `useReactive` Babel transform crashing at runtime when `react` is imported only as a type (e.g. `import type { FC } from 'react'`). The transform no longer reuses or augments `import type` declarations from `react` when supplying the `useCallback` identifier used by the generated memoization wrapper, mirroring the guard already present in the sibling `callback` transform.
