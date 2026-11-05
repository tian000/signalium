---
"signalium": patch
---

Fix `component()` leaking a render lease (and its relay subscriptions) when an async render throws a thenable that never settles and the mount is abandoned before commit. `holdLeaseUntilSettled` now bounds the pin with the same `SUSPENDED_LEASE_HOLD_TTLS` backstop as `holdSuspendedLease`, so an abandoned render's relays deactivate and its signal is released instead of staying pinned forever.
