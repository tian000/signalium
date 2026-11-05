---
'signalium': patch
---

Fix `registerCustomHash` discarding the cycle-tracking `seen` array, which caused `hashValue` to stack-overflow on cyclic object graphs passing through a custom-hashed class. The user hash function now receives `seen` and should forward it to nested `hashValue` calls, matching the built-in hashers.
