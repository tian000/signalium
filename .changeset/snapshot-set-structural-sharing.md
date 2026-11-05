---
'signalium': patch
---

Fix `snapshotSet` to structurally share Sets containing objects/arrays. Previously, `snapshotSet` looked up previous-snapshot elements by testing membership of the live element against the previous (deep-cloned) Set, which always missed for plain-object/array/nested-Map elements. This caused every `snapshot()` call on a Set of objects/arrays to return a brand-new Set with fully re-cloned elements, defeating `useSyncExternalStore`'s reference comparison in `useReactive` and triggering unnecessary React re-renders. Set elements are now paired with previous-snapshot elements by iteration position, mirroring how arrays pair by index and Maps by key.
