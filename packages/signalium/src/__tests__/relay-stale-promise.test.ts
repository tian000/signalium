import { describe, expect, test } from 'vitest';
import { relay, watcher } from '../index.js';
import type { RelayState } from '../types.js';
import { nextTick, sleep } from './utils/async.js';

describe('stale setPromise continuation', () => {
  test('stale promise resolution does not overwrite a direct value write', async () => {
    let st!: RelayState<number>;
    let resolveSlow!: (v: number) => void;
    const slow = new Promise<number>(res => {
      resolveSlow = res;
    });

    const r = relay<number>(state => {
      st = state;
      state.setPromise(slow);
      return () => {};
    });

    const w = watcher(() => r.value);
    w.addListener(() => {});
    await nextTick();

    expect(r.isPending).toBe(true);

    st.value = 100;
    expect(r.value).toBe(100);
    expect(r.isResolved).toBe(true);

    resolveSlow(42);
    await nextTick();

    expect(r.value).toBe(100);
    expect(r.isResolved).toBe(true);
  });

  test('stale promise rejection does not overwrite a direct error write', async () => {
    let st!: RelayState<number>;
    let rejectSlow!: (e: unknown) => void;
    const slow = new Promise<number>((_, rej) => {
      rejectSlow = rej;
    });

    const r = relay<number>(state => {
      st = state;
      state.setPromise(slow);
      return () => {};
    });

    const w = watcher(() => r.value);
    w.addListener(() => {});
    await nextTick();

    const fresh = new Error('fresh');
    st.setError(fresh);
    expect(r.error).toEqual(fresh);
    expect(r.isRejected).toBe(true);

    rejectSlow(new Error('stale'));
    await nextTick();

    expect(r.error).toEqual(fresh);
    expect(r.isRejected).toBe(true);
  });

  test('stale promise resolution does not re-notify consumers', async () => {
    let st!: RelayState<number>;
    let resolveSlow!: (v: number) => void;
    const slow = new Promise<number>(res => {
      resolveSlow = res;
    });

    const r = relay<number>(state => {
      st = state;
      state.setPromise(slow);
      return () => {};
    });

    const w = watcher(() => r.value);
    let callCount = 0;
    const unsub = w.addListener(() => {
      callCount++;
    });
    await nextTick();

    expect(r.isPending).toBe(true);

    st.value = 100;
    await nextTick();
    const callsAfterDirectSettle = callCount;
    expect(r.value).toBe(100);

    resolveSlow(42);
    await nextTick();

    expect(callCount).toBe(callsAfterDirectSettle);
    expect(r.value).toBe(100);

    unsub();
  });

  test('direct settle then new setPromise resolves correctly', async () => {
    let st!: RelayState<number>;
    let resolveSlow!: (v: number) => void;
    const slow = new Promise<number>(res => {
      resolveSlow = res;
    });

    const r = relay<number>(state => {
      st = state;
      state.setPromise(slow);
      return () => {};
    });

    const w = watcher(() => r.value);
    w.addListener(() => {});
    await nextTick();

    expect(r.isPending).toBe(true);

    st.value = 100;
    expect(r.value).toBe(100);

    let resolveFast!: (v: number) => void;
    const fast = new Promise<number>(res => {
      resolveFast = res;
    });
    st.setPromise(fast);
    expect(r.isPending).toBe(true);

    resolveSlow(42);
    await nextTick();
    expect(r.isPending).toBe(true);

    resolveFast(200);
    await nextTick();

    expect(r.value).toBe(200);
    expect(r.isResolved).toBe(true);
  });

  test('stale promise from prior activation does not clobber re-activated direct write', async () => {
    let st!: RelayState<number>;
    let resolveSlow!: (v: number) => void;
    const slow = new Promise<number>(res => {
      resolveSlow = res;
    });

    let activationCount = 0;
    const r = relay<number>(state => {
      st = state;
      activationCount++;
      if (activationCount === 1) {
        state.setPromise(slow);
      } else {
        state.value = 100;
      }
      return () => {};
    });

    const w = watcher(() => r.value);
    const unsub1 = w.addListener(() => {});
    await nextTick();

    expect(r.isPending).toBe(true);
    expect(activationCount).toBe(1);

    unsub1();
    await nextTick();
    await sleep(10);

    const unsub2 = w.addListener(() => {});
    await nextTick();

    expect(activationCount).toBe(2);
    expect(r.value).toBe(100);

    resolveSlow(42);
    await nextTick();

    expect(r.value).toBe(100);
  });
});
