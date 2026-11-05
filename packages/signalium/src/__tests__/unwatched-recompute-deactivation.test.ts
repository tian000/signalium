import { describe, expect, test } from 'vitest';
import { signal, reactiveSignal, relay, watcher } from '../index.js';
import { unwatchSignal } from '../internals/watch.js';
import { ReactiveSignal } from '../internals/reactive.js';
import { nextTick } from './utils/async.js';

describe('unwatched-but-active recompute window', () => {
  /**
   * Exercises the path where:
   * 1. A watcher (z) actively subscribes to a relay (target)
   * 2. Another watcher (w) conditionally reads target, initially not reading it
   * 3. flag flips to true, scheduling a pull for w
   * 4. w is paused (unwatchSignal with isPausing: true) before the flush runs
   * 5. The flush runs PULL (recomputes w, which reads target for the first time) then DEACTIVATE
   *
   * The recompute in step 5 must take a real watch on target (since w is still active),
   * so deactivateSignal only releases watches w actually held. Without the fix,
   * the dep edge is recorded without a watch and deactivateSignal phantom-decrements
   * target's watchCount (dropping z's watch from 1 to 0), deactivating target and
   * firing its relay cleanup while z is still subscribed.
   */
  test('pause during pending recompute does not corrupt relay dep watchCounts or fire cleanup', async () => {
    let cleanupFired = false;

    const target = relay<number>(state => {
      state.value = 10;
      return {
        deactivate: () => {
          cleanupFired = true;
        },
      };
    });

    // z actively subscribes to target — takes a watch on target's signal
    const z = watcher(() => target.value);
    const zUnsub = z.addListener(() => {});
    await nextTick();
    expect(z.value).toBe(10);

    const targetSig = (target as any)._signal as ReactiveSignal<any, any>;
    expect(targetSig.watchCount).toBe(1);
    expect(targetSig._isActive).toBe(true);

    // w conditionally reads target — initially does NOT read it
    const flag = signal(false);
    const w = watcher(() => (flag.value ? target.value : 'init'));
    const wSig = w as unknown as ReactiveSignal<any, any>;
    const wUnsub = w.addListener(() => {});
    await nextTick();
    expect(w.value).toBe('init');

    // target should still have watchCount 1 (only z watches it)
    expect(targetSig.watchCount).toBe(1);

    // flag flips to true — schedules a pull for w (w is a listener, watched)
    flag.value = true;

    // pause w before the flush runs — watchCount -> 0, deactivation scheduled,
    // but the pending pull is NOT cancelled
    unwatchSignal(wSig, { isPausing: true });

    // flush: PULL phase recomputes w (reads target for the first time),
    // then DEACTIVATE phase deactivates w
    await nextTick();

    // w did recompute and read target
    expect(w.value).toBe(10);

    // CORRECT behavior: target's watchCount should still be 1 (held by z),
    // target should still be active, and cleanup should NOT have fired
    expect(targetSig.watchCount).toBe(1);
    expect(targetSig._isActive).toBe(true);
    expect(cleanupFired).toBe(false);

    // z should still have the correct value
    expect(z.value).toBe(10);

    zUnsub();
    wUnsub();
  });

  /**
   * Same bug but for the non-relay path (getSignal). A reactiveSignal read for
   * the first time during the unwatched-but-active window must take a real watch
   * so deactivateSignal doesn't phantom-decrement another watcher's watch.
   */
  test('pause during pending recompute does not corrupt signal dep watchCounts', async () => {
    const x = reactiveSignal(() => 10);
    const xSig = x as unknown as ReactiveSignal<any, any>;

    // z2 actively subscribes to x
    const z2 = watcher(() => x.value);
    const z2Unsub = z2.addListener(() => {});
    await nextTick();
    expect(z2.value).toBe(10);
    expect(xSig.watchCount).toBe(1);
    expect(xSig._isActive).toBe(true);

    // w conditionally reads x — initially does NOT read it
    const flag = signal(false);
    const w = watcher(() => (flag.value ? x.value : 'init'));
    const wSig = w as unknown as ReactiveSignal<any, any>;
    const wUnsub = w.addListener(() => {});
    await nextTick();
    expect(w.value).toBe('init');
    expect(xSig.watchCount).toBe(1);

    // flag flips, then pause w before the flush
    flag.value = true;
    unwatchSignal(wSig, { isPausing: true });
    await nextTick();

    // w recomputed and read x
    expect(w.value).toBe(10);

    // x should still be watched by z2 — no phantom decrement
    expect(xSig.watchCount).toBe(1);
    expect(xSig._isActive).toBe(true);

    z2Unsub();
    wUnsub();
  });

  /**
   * Verifies that a still-subscribed watcher continues to receive updates
   * after another watcher is paused during a pending recompute. The relay
   * must not be torn down (which would wipe signal.subs and interrupt
   * notification delivery to the remaining subscriber).
   */
  test('still-subscribed watcher continues to receive updates after pause during recompute', async () => {
    const source = signal(10);
    let cleanupFired = false;

    const target = relay<number>(state => {
      state.value = source.value;
      return {
        update: () => {
          state.value = source.value;
        },
        deactivate: () => {
          cleanupFired = true;
        },
      };
    });

    const zValues: number[] = [];
    const z = watcher(() => target.value);
    const zUnsub = z.addListener(() => {
      zValues.push(z.value as number);
    });
    await nextTick();
    expect(z.value).toBe(10);
    expect(zValues).toEqual([10]);

    const flag = signal(false);
    const w = watcher(() => (flag.value ? target.value : 'init'));
    const wSig = w as unknown as ReactiveSignal<any, any>;
    const wUnsub = w.addListener(() => {});
    await nextTick();
    expect(w.value).toBe('init');

    // flag flips, then pause w before the flush
    flag.value = true;
    unwatchSignal(wSig, { isPausing: true });
    await nextTick();

    // w recomputed and read target
    expect(w.value).toBe(10);

    // relay should not have been torn down
    expect(cleanupFired).toBe(false);

    // z should still receive updates when source changes
    source.value = 20;
    await nextTick();
    expect(z.value).toBe(20);
    expect(zValues).toContain(20);

    zUnsub();
    wUnsub();
  });
});
