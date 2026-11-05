---
'signalium': patch
---

Fix the dev-mode tracer crashing with `RangeError: Maximum call stack size exceeded` when a reactive function is called with a circular or mutually-referential plain object/array argument. `stringifyValue` now tracks visited nodes (mirroring the existing `hashValue` cycle handling) and emits a stable `[Circular: <index>]` marker instead of recursing forever.
