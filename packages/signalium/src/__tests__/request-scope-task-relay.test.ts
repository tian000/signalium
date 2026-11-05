import { describe, expect, test, afterEach, beforeEach } from 'vitest';
import { reactive, task, relay, watcher, context, getContext, setRequestScopeGetter, signal } from 'signalium';
import { SignalScope, getGlobalScope, getSignalsMap, clearGlobalContexts } from '../internals/contexts.js';
import { nextTick } from './utils/async.js';

afterEach(() => {
  setRequestScopeGetter(undefined);
  clearGlobalContexts();
});

beforeEach(() => {
  clearGlobalContexts();
});

describe('request-scope isolation for task()', () => {
  test('module-level task re-evaluates inner reactive per request', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);
    const runOnce = task(async () => {
      return counter();
    });

    const scopeA = new SignalScope([]);
    activeScope = scopeA;
    const a = await runOnce.run();
    expect(a).toBe(1);
    expect(getSignalsMap(scopeA).size).toBeGreaterThan(0);

    const scopeB = new SignalScope([]);
    activeScope = scopeB;
    const b = await runOnce.run();
    expect(b).toBe(2);
    expect(getSignalsMap(scopeB).size).toBeGreaterThan(0);
  });

  test('getContext inside module-level task resolves to per-request context', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    const userCtx = context('default-user');

    const getUser = task(async () => {
      return getContext(userCtx);
    });

    activeScope = new SignalScope([]);
    activeScope.setContexts([[userCtx as any, 'alice']]);
    const a = await getUser.run();
    expect(a).toBe('alice');

    activeScope = new SignalScope([]);
    activeScope.setContexts([[userCtx as any, 'bob']]);
    const b = await getUser.run();
    expect(b).toBe('bob');
  });

  test('task created inside a per-request reactive computation keeps its binding', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);

    const taskFactory = reactive(() => {
      return task(async () => counter());
    });

    activeScope = new SignalScope([]);
    const taskInScopeA = taskFactory();
    const a = await taskInScopeA.run();
    expect(a).toBe(1);

    activeScope = new SignalScope([]);
    const b = await taskInScopeA.run();
    expect(b).toBe(1);
  });

  test('task with generator body (await) resolves scope per request', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);
    const runOnce = task(async () => {
      await Promise.resolve();
      return counter();
    });

    activeScope = new SignalScope([]);
    const a = await runOnce.run();
    expect(a).toBe(1);

    activeScope = new SignalScope([]);
    const b = await runOnce.run();
    expect(b).toBe(2);
  });

  test('without getter, task falls back to global scope (no leak)', async () => {
    let n = 0;
    const runOnce = task(async () => ++n);

    const a = await runOnce.run();
    expect(a).toBe(1);

    const b = await runOnce.run();
    expect(b).toBe(2);
  });
});

describe('request-scope isolation for relay()', () => {
  test('module-level relay re-computes per request', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);
    const myRelay = relay(state => {
      state.value = counter();
    });

    const w = watcher(() => myRelay.value);

    activeScope = new SignalScope([]);
    const unsubA = w.addListener(() => {});
    expect(w.value).toBe(1);
    unsubA();
    await nextTick();

    activeScope = new SignalScope([]);
    const unsubB = w.addListener(() => {});
    expect(w.value).toBe(2);
    unsubB();
  });

  test('getContext inside module-level relay resolves to per-request context', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    const userCtx = context('default-user');

    const myRelay = relay(state => {
      state.value = getContext(userCtx);
    });

    const w = watcher(() => myRelay.value);

    activeScope = new SignalScope([]);
    activeScope.setContexts([[userCtx as any, 'alice']]);
    const unsubA = w.addListener(() => {});
    expect(w.value).toBe('alice');
    unsubA();
    await nextTick();

    activeScope = new SignalScope([]);
    activeScope.setContexts([[userCtx as any, 'bob']]);
    const unsubB = w.addListener(() => {});
    expect(w.value).toBe('bob');
    unsubB();
  });

  test('relay created inside a per-request reactive computation keeps its binding', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);

    const relayFactory = reactive(() => {
      return relay(state => {
        state.value = counter();
      });
    });

    activeScope = new SignalScope([]);
    const relayInScopeA = relayFactory();
    const w = watcher(() => relayInScopeA.value);
    const unsubA = w.addListener(() => {});
    expect(w.value).toBe(1);
    unsubA();
    await nextTick();

    activeScope = new SignalScope([]);
    const w2 = watcher(() => relayInScopeA.value);
    const unsubB = w2.addListener(() => {});
    expect(w2.value).toBe(1);
    unsubB();
  });
});

describe('request-scope isolation for watcher()', () => {
  test('module-level watcher resolves inner reactive in per-request scope on first computation', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    let n = 0;
    const counter = reactive(() => ++n);
    const w = watcher(() => counter());

    activeScope = new SignalScope([]);
    const unsub = w.addListener(() => {});
    expect(w.value).toBe(1);
    expect(getSignalsMap(activeScope).size).toBeGreaterThan(0);
    unsub();
  });

  test('module-level watcher with getContext resolves per-request context on first computation', async () => {
    let activeScope: SignalScope | null = null;
    setRequestScopeGetter(() => activeScope ?? undefined);

    const userCtx = context('default-user');
    const w = watcher(() => getContext(userCtx));

    activeScope = new SignalScope([]);
    activeScope.setContexts([[userCtx as any, 'alice']]);
    const unsub = w.addListener(() => {});
    expect(w.value).toBe('alice');
    unsub();
  });
});
