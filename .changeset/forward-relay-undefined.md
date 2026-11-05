---
'signalium': patch
---

Fix `forwardRelay` leaving the target relay pending when the source settles to `undefined`. The resolved and rejected branches dropped `undefined` values via a `!== undefined` guard, but `undefined` is a valid resolved value and a valid rejection reason — so the target relay was never settled and stayed pending forever. Both branches now forward the settled value/error unconditionally.
