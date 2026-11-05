import { describe, expect, test } from 'vitest';
import { signal } from '../index.js';
import { reactive } from './utils/instrumented-hooks.js';
import { sleep } from './utils/async.js';

const GUARD_MESSAGE =
  'A signal was dirtied after it was consumed by the current function. This can cause race conditions and infinite rerenders and is not allowed.';

const drainMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('dirty guard fan-out', () => {
  test('async reactive function that dirties consumed signal does not leave later subscribers stale', async () => {
    const s = signal(0);

    const f = reactive(async () => {
      const v = s.value;
      await new Promise<void>(resolve => queueMicrotask(resolve));
      s.value = 1;
      return v;
    });

    const c = reactive(() => s.value * 10);

    const rp = f();
    expect(c()).toBe(0);

    await drainMicrotasks();

    expect(s.value).toBe(1);
    expect(rp.isRejected).toBe(true);
    expect((rp.error as Error).message).toBe(GUARD_MESSAGE);
    expect(c()).toBe(10);
  });

  test('guard rejection does not leave the offending signal in Dirty state', async () => {
    const s = signal(0);

    const f = reactive(async () => {
      const v = s.value;
      await new Promise<void>(resolve => queueMicrotask(resolve));
      s.value = 1;
      return v;
    });

    const rp = f();
    expect(rp.isPending).toBe(true);

    await drainMicrotasks();

    expect(rp.isRejected).toBe(true);
    expect((rp.error as Error).message).toBe(GUARD_MESSAGE);

    // A subsequent write to `s` should still propagate to subscribers. If the
    // guard left the offending signal in Dirty state, this second write would
    // be silently no-op'd for that subscriber.
    s.value = 2;
    await drainMicrotasks();
    expect(s.value).toBe(2);
  });

  test('multiple later subscribers all receive the update', async () => {
    const s = signal(0);

    const f = reactive(async () => {
      const v = s.value;
      await new Promise<void>(resolve => queueMicrotask(resolve));
      s.value = 1;
      return v;
    });

    const c1 = reactive(() => s.value * 10);
    const c2 = reactive(() => s.value * 100);
    const c3 = reactive(() => s.value * 1000);

    const rp = f();
    expect(c1()).toBe(0);
    expect(c2()).toBe(0);
    expect(c3()).toBe(0);

    await drainMicrotasks();

    expect(s.value).toBe(1);
    expect(rp.isRejected).toBe(true);
    expect((rp.error as Error).message).toBe(GUARD_MESSAGE);
    expect(c1()).toBe(10);
    expect(c2()).toBe(100);
    expect(c3()).toBe(1000);
  });

  test('listeners are scheduled even when the guard fires', async () => {
    const s = signal(0);
    let listenerCallCount = 0;

    const f = reactive(async () => {
      const v = s.value;
      await new Promise<void>(resolve => queueMicrotask(resolve));
      s.value = 1;
      return v;
    });

    const c = reactive(() => s.value * 10);

    const unsub = s.addListener(() => {
      listenerCallCount++;
    });

    const rp = f();
    expect(c()).toBe(0);

    await drainMicrotasks();
    await sleep(10);

    expect(s.value).toBe(1);
    expect(rp.isRejected).toBe(true);
    expect(listenerCallCount).toBeGreaterThan(0);

    unsub();
  });
});
