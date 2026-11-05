import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearGlobalContexts,
  context,
  getContext,
  reactive,
  setGlobalContexts,
  signal,
  watcher,
  withContexts,
  reactiveSignal,
} from '../index.js';
import { nextTick } from './utils/async.js';

describe('setGlobalContexts live subscriber invalidation (repro)', () => {
  beforeEach(() => clearGlobalContexts());

  it('updates a watcher that reads getContext directly', async () => {
    const ctx = context<string>('ctx');

    setGlobalContexts([[ctx, 'a']]);
    const w = watcher(() => getContext(ctx));
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    expect(w.value).toBe('b');
    expect(calls).toBe(1);
  });

  it('updates a watcher that reads a derived reactive depending on a context', async () => {
    const ctx = context<string>('ctx');

    const derived = reactive(() => getContext(ctx));

    setGlobalContexts([[ctx, 'a']]);
    expect(derived()).toBe('a');

    const w = watcher(() => derived());
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    expect(w.value).toBe('b');
    expect(derived()).toBe('b');
    expect(calls).toBe(1);
  });

  it('does not create divergent stale instances after setGlobalContexts', async () => {
    const ctx = context<string>('ctx');

    const derived = reactive(() => getContext(ctx));

    setGlobalContexts([[ctx, 'a']]);
    expect(derived()).toBe('a');

    const w = watcher(() => derived());
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    expect(w.value).toBe('b');
    expect(derived()).toBe('b');
    expect(calls).toBe(1);
  });

  it('invalidates cached withContexts child scopes', async () => {
    const ctx = context<string>('ctx');

    const derived = reactive(() => getContext(ctx));

    setGlobalContexts([[ctx, 'a']]);
    expect(withContexts([], () => derived())).toBe('a');

    setGlobalContexts([[ctx, 'b']]);
    expect(withContexts([], () => derived())).toBe('b');
  });

  it('updates a reactiveSignal that reads getContext directly', async () => {
    const ctx = context<string>('ctx');

    setGlobalContexts([[ctx, 'a']]);
    const rs = reactiveSignal(() => getContext(ctx));
    expect(rs.value).toBe('a');

    let calls = 0;
    rs.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    expect(rs.value).toBe('b');
    expect(calls).toBe(1);
  });

  it('preserves signal-valued context mutation behavior (control)', async () => {
    const s = signal('a');
    const ctx = context<typeof s>(s);

    setGlobalContexts([[ctx, s]]);
    const w = watcher(() => getContext(ctx).value);
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    s.value = 'a2';
    await nextTick();

    expect(w.value).toBe('a2');
    expect(calls).toBe(1);
  });

  it('updates multiple contexts at once', async () => {
    const ctx1 = context<string>('ctx1');
    const ctx2 = context<string>('ctx2');

    const derived = reactive(() => `${getContext(ctx1)}-${getContext(ctx2)}`);

    setGlobalContexts([
      [ctx1, 'a'],
      [ctx2, 'x'],
    ]);
    expect(derived()).toBe('a-x');

    const w = watcher(() => derived());
    expect(w.value).toBe('a-x');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([
      [ctx1, 'b'],
      [ctx2, 'y'],
    ]);
    await nextTick();

    expect(w.value).toBe('b-y');
    expect(derived()).toBe('b-y');
    expect(calls).toBe(1);
  });

  it('invalidates nested withContexts child scopes', async () => {
    const ctx1 = context<string>('ctx1');
    const ctx2 = context<string>('ctx2');

    const derived = reactive(() => `${getContext(ctx1)}-${getContext(ctx2)}`);

    setGlobalContexts([
      [ctx1, 'a'],
      [ctx2, 'x'],
    ]);

    const result1 = withContexts([[ctx2, 'override2']], () => withContexts([[ctx1, 'override1']], () => derived()));
    expect(result1).toBe('override1-override2');

    setGlobalContexts([
      [ctx1, 'b'],
      [ctx2, 'y'],
    ]);

    const result2 = withContexts([[ctx2, 'override2']], () => withContexts([[ctx1, 'override1']], () => derived()));
    expect(result2).toBe('override1-override2');
  });

  it('updates a watcher created inside withContexts when parent context changes', async () => {
    const ctx = context<string>('ctx');
    const derived = reactive(() => getContext(ctx));

    setGlobalContexts([[ctx, 'a']]);

    const w = withContexts([[ctx, 'local']], () => watcher(() => derived()));
    expect(w.value).toBe('local');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    // Watcher was created in the child scope which overrides ctx with 'local',
    // so it should keep observing 'local' (the child's own override).
    expect(w.value).toBe('local');
    expect(calls).toBe(0);
  });

  it('updates a watcher created in the global scope reading a context directly', async () => {
    const ctx = context<string>('ctx');

    setGlobalContexts([[ctx, 'a']]);

    const w = watcher(() => getContext(ctx));
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    expect(w.value).toBe('b');
    expect(calls).toBe(1);

    setGlobalContexts([[ctx, 'c']]);
    await nextTick();

    expect(w.value).toBe('c');
    expect(calls).toBe(2);
  });

  it('does not affect isolated watchers', async () => {
    const ctx = context<string>('default');

    setGlobalContexts([[ctx, 'a']]);

    const w = watcher(() => getContext(ctx), { isolate: true });
    // Isolated watchers have their own scope with no parent, so they see the
    // context's default value, not the global override.
    expect(w.value).toBe('default');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    // Isolated watchers are unaffected by global context changes.
    expect(w.value).toBe('default');
    expect(calls).toBe(0);
  });

  it('withContexts local overrides still take precedence after parent context change', () => {
    const ctx1 = context<string>('ctx1');
    const ctx2 = context<string>('ctx2');

    const derived = reactive(() => `${getContext(ctx1)}-${getContext(ctx2)}`);

    setGlobalContexts([
      [ctx1, 'a'],
      [ctx2, 'x'],
    ]);
    expect(withContexts([[ctx1, 'local1']], () => derived())).toBe('local1-x');

    setGlobalContexts([
      [ctx1, 'b'],
      [ctx2, 'y'],
    ]);

    // Local override for ctx1 still takes precedence; ctx2 inherits the new global value.
    expect(withContexts([[ctx1, 'local1']], () => derived())).toBe('local1-y');
  });

  it('clearGlobalContexts still orphans the scope', async () => {
    const ctx = context<string>('ctx');

    setGlobalContexts([[ctx, 'a']]);
    const w = watcher(() => getContext(ctx));
    expect(w.value).toBe('a');

    let calls = 0;
    w.addListener(
      () => {
        calls++;
      },
      { skipInitial: true },
    );
    await nextTick();

    clearGlobalContexts();
    setGlobalContexts([[ctx, 'b']]);
    await nextTick();

    // The old watcher was bound to the orphaned scope; it keeps the old value.
    expect(w.value).toBe('a');
    expect(calls).toBe(0);

    // A fresh watcher sees the new value.
    const w2 = watcher(() => getContext(ctx));
    expect(w2.value).toBe('b');
  });
});
