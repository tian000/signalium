---
'signalium': patch
---

Fix server-side `task()`, `relay()`, and `watcher()` leaking state across requests when created at module top level. They captured their `SignalScope` once at creation time, freezing it permanently — so a module-level task/relay/watcher was bound to `GLOBAL_SCOPE` (or a throwaway scope) and every subsequent invocation reused that same scope, defeating `setupRscRequestScope()`'s per-request isolation. `getContext()` inside a module-level task/relay body resolved to the frozen scope's context or the default instead of the current request's context, causing cross-request state leakage. These primitives now resolve their scope lazily at each invocation (like `reactive()` already did) when created outside an active request/consumer scope, while keeping the existing binding for primitives created inside a request.
