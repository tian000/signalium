---
'signalium': patch
---

Fix `component()` walking React element trees nested inside plain-object props when hashing. A React element nested inside a plain-object prop (e.g. `config={{ icon: <El /> }}`) was structurally walked — reading through `props`, `_owner` and `_store`, re-hashing whole element subtrees on every render, and reaching user-supplied proxy traps inside the nested element's props — exactly the behavior PR #251 eliminated for direct and array-valued element props. Elements nested at any depth inside a plain-object prop are now identity-hashed (opaque), matching the existing treatment for direct and array-valued element props.
