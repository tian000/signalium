import { describe, expect, test } from 'vitest';
import { signal, reactive as _reactive, watcher } from 'signalium';
import { sleep } from './utils/async.js';

/**
 * Reproduction for the stale-continuation dependency leak.
 *
 * Async reactive functions are compiled to generators whose continuations are
 * driven by `generatorResultToPromiseWithConsumer`. That driver re-installs the
 * owning signal as the dependency-tracking consumer at every step so that
 * post-`await` reads register graph edges.
 *
 * The bug: a stale (superseded) run's continuation is never cancelled, and when
 * it resumes it re-installs the signal as consumer and registers its dependency
 * reads with the signal's *current* `computedCount` — i.e. the *new* run's
 * count. The graph then believes the new run depends on deps it never read, so
 * when such a dep later changes the compute body re-executes spuriously.
 *
 * The fix captures a per-run epoch (`runEpoch = signal.computedCount` at
 * `runSignal` start) and passes it to `generatorResultToPromiseWithConsumer`.
 * Before re-installing the consumer, each step validates
 * `savedConsumer.computedCount === runEpoch`; if the run was superseded the
 * remaining steps run untracked and cannot register dependency edges/subs.
 */
describe('stale continuation dependency leak', () => {
  test('stale continuation from a superseded run does not register dependencies for the current run', async () => {
    const mode = signal(true);
    const depX = signal(1);
    let computeCount = 0;
    const postAwaitLogs: boolean[] = [];

    const asyncFn = _reactive(async () => {
      computeCount++;
      const m = mode.value;
      await sleep(50);
      postAwaitLogs.push(m);
      if (m) {
        void depX.value;
      }
      return m ? 'with-x' : 'no-x';
    });

    const consumer = watcher(() => {
      const result = asyncFn();
      return result.value;
    });
    const unsub = consumer.addListener(() => {});

    // Run 1 starts with mode=true (computedCount becomes 1) and suspends at
    // `await sleep(50)`.
    await sleep(10);

    // While run 1 is still suspended, change mode to false. This dirties the
    // async signal and starts run 2 (computedCount becomes 2) with mode=false.
    // Run 2 therefore never reads depX.
    mode.value = false;

    // Wait long enough for both runs' 50ms awaits to resolve. Run 1's stale
    // continuation resumes and (without the fix) reads depX.value, stamping the
    // read with the live computedCount (2) — the new run's count.
    await sleep(80);

    // Both runs should have executed their bodies exactly once.
    expect(postAwaitLogs).toEqual([true, false]);
    expect(computeCount).toBe(2);

    // Now change depX. The current run (run 2) never read depX, so this should
    // NOT trigger a recomputation. Without the fix, the stale continuation's
    // registration survives and causes a spurious third run.
    const countBefore = computeCount;
    depX.value = 999;

    await sleep(30);

    expect(computeCount).toBe(countBefore);

    unsub();
  });

  test('control: no spurious recomputation when runs do not overlap', async () => {
    // Same code path as above, but run 2 starts only after run 1 has fully
    // settled. This isolates the cause to the stale continuation: without an
    // overlap there is no superseded continuation to leak the registration.
    const mode = signal(true);
    const depX = signal(1);
    let computeCount = 0;

    const asyncFn = _reactive(async () => {
      computeCount++;
      const m = mode.value;
      await sleep(50);
      if (m) {
        void depX.value;
      }
      return m ? 'with-x' : 'no-x';
    });

    const consumer = watcher(() => {
      const result = asyncFn();
      return result.value;
    });
    const unsub = consumer.addListener(() => {});

    // Run 1 starts with mode=true and fully settles.
    await sleep(70);
    expect(computeCount).toBe(1);

    // Now change mode to false — run 2 starts only after run 1 settled.
    mode.value = false;
    await sleep(70);
    expect(computeCount).toBe(2);

    // depX was only read by run 1 (mode=true). Run 2 (mode=false) did not read
    // it, and since run 1 fully settled before run 2 started, there is no
    // stale continuation to leak the registration. Changing depX must not
    // trigger a recomputation.
    const countBefore = computeCount;
    depX.value = 999;
    await sleep(30);
    expect(computeCount).toBe(countBefore);

    unsub();
  });

  test('stale continuation does not register reactive-signal (computed) dependencies either', async () => {
    // Same scenario as the first test, but depX is a *computed* reactive signal
    // (read via getSignal/createEdge) rather than a plain StateSignal. The
    // stale continuation's edge would be stamped with the live computedCount
    // and survive disconnectSignal's pruning sweep (consumedAt === computedCount).
    const mode = signal(true);
    const depXRaw = signal(1);
    let depXCount = 0;
    const depX = _reactive(() => {
      depXCount++;
      return depXRaw.value * 10;
    });

    let computeCount = 0;
    const postAwaitLogs: boolean[] = [];

    const asyncFn = _reactive(async () => {
      computeCount++;
      const m = mode.value;
      await sleep(50);
      postAwaitLogs.push(m);
      if (m) {
        void depX().value;
      }
      return m ? 'with-x' : 'no-x';
    });

    const consumer = watcher(() => {
      const result = asyncFn();
      return result.value;
    });
    const unsub = consumer.addListener(() => {});

    // Run 1 starts with mode=true and suspends.
    await sleep(10);

    // Start run 2 with mode=false (does not read depX).
    mode.value = false;

    // Wait for both runs to settle.
    await sleep(80);
    expect(postAwaitLogs).toEqual([true, false]);
    expect(computeCount).toBe(2);

    // Changing depXRaw should not recompute asyncFn, because the current run
    // (run 2) never read depX. Without the fix, the stale continuation's edge
    // (consumedAt === 2) survives and triggers a spurious third run.
    const countBefore = computeCount;
    depXRaw.value = 999;
    await sleep(30);
    expect(computeCount).toBe(countBefore);

    unsub();
  });

  test('non-superseded run still tracks post-await dependencies and recomputes when they change', async () => {
    // Regression guard: the fix must not break normal post-await dependency
    // tracking for the *current* (non-stale) run. When the current run reads a
    // dep after an await and that dep later changes, the body must re-execute.
    const mode = signal(true);
    const depX = signal(1);
    let computeCount = 0;

    const asyncFn = _reactive(async () => {
      computeCount++;
      const m = mode.value;
      await sleep(20);
      if (m) {
        void depX.value;
      }
      return m ? `with-x-${depX.value}` : 'no-x';
    });

    const consumer = watcher(() => {
      const result = asyncFn();
      return result.value;
    });
    const unsub = consumer.addListener(() => {});

    // Run 1 starts with mode=true, reads depX after the await, settles.
    await sleep(40);
    expect(computeCount).toBe(1);
    expect(consumer.value).toBe('with-x-1');

    // No overlap — change depX after run 1 settled. Run 1 read depX, so this
    // must trigger a recomputation.
    depX.value = 2;
    await sleep(40);
    expect(computeCount).toBe(2);
    expect(consumer.value).toBe('with-x-2');

    unsub();
  });

  test('overlapping run that reads the same dep still recomputes when it changes', async () => {
    // Regression guard: when both the stale run and the new run read the same
    // dep, changing that dep must still trigger a recomputation (the new run
    // legitimately depends on it). The fix only prevents *extra* deps from
    // being registered, not legitimate ones.
    const mode = signal(true);
    const depX = signal(1);
    let computeCount = 0;

    const asyncFn = _reactive(async () => {
      computeCount++;
      const m = mode.value;
      await sleep(50);
      // Both runs read depX unconditionally.
      void depX.value;
      return m ? `with-x-${depX.value}` : `no-x-${depX.value}`;
    });

    const consumer = watcher(() => {
      const result = asyncFn();
      return result.value;
    });
    const unsub = consumer.addListener(() => {});

    // Run 1 starts with mode=true and suspends.
    await sleep(10);

    // Start run 2 (mode=false). Both runs read depX.
    mode.value = false;
    await sleep(80);
    expect(computeCount).toBe(2);
    expect(consumer.value).toBe('no-x-1');

    // depX was read by the current run (run 2), so changing it must recompute.
    depX.value = 2;
    await sleep(80);
    expect(computeCount).toBe(3);
    expect(consumer.value).toBe('no-x-2');

    unsub();
  });
});
