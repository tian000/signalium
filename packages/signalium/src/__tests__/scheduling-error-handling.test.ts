import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { signal, reactiveSignal } from '../index.js';
import { batch, settled } from '../internals/scheduling.js';
import { sleep } from './utils/async.js';

const withTimeout = <T>(promise: Promise<T>, ms = 300): Promise<T | 'TIMEOUT'> =>
  Promise.race([promise.then(() => 'RESOLVED' as const), sleep(ms).then(() => 'TIMEOUT' as const)]);

describe('scheduling error handling', () => {
  describe('throwing compute during flush', () => {
    let rejections: unknown[] = [];
    let rejectionHandler: (reason: unknown) => void;

    beforeEach(() => {
      rejections = [];
      rejectionHandler = (reason: unknown) => {
        rejections.push(reason);
      };
      process.on('unhandledRejection', rejectionHandler);
    });

    afterEach(() => {
      process.off('unhandledRejection', rejectionHandler);
    });

    test('scheduler survives a throwing compute — subsequent unrelated update is processed', async () => {
      const state = signal(0);
      const derived = reactiveSignal<number>(() => {
        if (state.value > 0) throw new Error('boom');
        return state.value;
      });
      const unsub = (derived as any).addListener(() => {});
      expect(derived.value).toBe(0);

      const other = signal(0);
      let otherComputeCount = 0;
      const otherDerived = reactiveSignal<number>(() => {
        otherComputeCount++;
        return other.value * 10;
      });
      const otherListenerCalls: number[] = [];
      const unsub2 = (otherDerived as any).addListener((v: number) => otherListenerCalls.push(v));
      expect(otherDerived.value).toBe(0);
      expect(otherComputeCount).toBe(1);

      state.value = 1;
      await sleep(50);

      other.value = 5;
      await sleep(50);

      expect(otherComputeCount).toBeGreaterThanOrEqual(2);
      expect(otherListenerCalls.length).toBeGreaterThanOrEqual(1);
      expect(otherDerived.value).toBe(50);

      const settledResult = await withTimeout(settled());
      expect(settledResult).toBe('RESOLVED');

      expect(rejections.length).toBeGreaterThanOrEqual(1);
      expect((rejections[0] as Error).message).toBe('boom');

      unsub();
      unsub2();
    });

    test('settled() resolves after a throwing compute (does not hang)', async () => {
      const state = signal(0);
      const derived = reactiveSignal<number>(() => {
        if (state.value > 0) throw new Error('boom-settled');
        return state.value;
      });
      const unsub = (derived as any).addListener(() => {});
      expect(derived.value).toBe(0);

      state.value = 1;
      await sleep(50);

      const result = await withTimeout(settled());
      expect(result).toBe('RESOLVED');

      unsub();
    });
  });

  describe('throwing listener during flush', () => {
    let rejections: unknown[] = [];
    let rejectionHandler: (reason: unknown) => void;

    beforeEach(() => {
      rejections = [];
      rejectionHandler = (reason: unknown) => {
        rejections.push(reason);
      };
      process.on('unhandledRejection', rejectionHandler);
    });

    afterEach(() => {
      process.off('unhandledRejection', rejectionHandler);
    });

    test('scheduler survives a throwing listener — queue not poisoned, settled() resolves', async () => {
      const state = signal(0);
      let listenerThrowCount = 0;
      const derived = reactiveSignal<number>(() => state.value * 2);
      const unsub = (derived as any).addListener(() => {
        if (derived.value > 0) {
          listenerThrowCount++;
          throw new Error('listener-boom');
        }
      });
      expect(derived.value).toBe(0);

      state.value = 1;
      await sleep(50);

      expect(listenerThrowCount).toBe(1);

      const settledResult1 = await withTimeout(settled());
      expect(settledResult1).toBe('RESOLVED');

      const other = signal(0);
      let otherComputeCount = 0;
      const otherDerived = reactiveSignal<number>(() => {
        otherComputeCount++;
        return other.value * 10;
      });
      const otherListenerCalls: number[] = [];
      const unsub2 = (otherDerived as any).addListener((v: number) => otherListenerCalls.push(v));
      expect(otherDerived.value).toBe(0);

      other.value = 5;
      await sleep(50);

      expect(otherComputeCount).toBeGreaterThanOrEqual(2);
      expect(otherListenerCalls.length).toBeGreaterThanOrEqual(1);
      expect(otherDerived.value).toBe(50);

      expect(listenerThrowCount).toBe(1);

      const settledResult2 = await withTimeout(settled());
      expect(settledResult2).toBe('RESOLVED');

      expect(rejections.length).toBeGreaterThanOrEqual(1);
      expect((rejections[0] as Error).message).toBe('listener-boom');

      unsub();
      unsub2();
    });
  });

  describe('batch with throwing compute', () => {
    let rejections: unknown[] = [];
    let rejectionHandler: (reason: unknown) => void;

    beforeEach(() => {
      rejections = [];
      rejectionHandler = (reason: unknown) => {
        rejections.push(reason);
      };
      process.on('unhandledRejection', rejectionHandler);
    });

    afterEach(() => {
      process.off('unhandledRejection', rejectionHandler);
    });

    test('settled() resolves after batch() triggers a throwing compute', async () => {
      const state = signal(0);
      const derived = reactiveSignal<number>(() => {
        if (state.value > 0) throw new Error('batch-boom');
        return state.value;
      });
      const unsub = (derived as any).addListener(() => {});
      expect(derived.value).toBe(0);

      batch(() => {
        state.value = 1;
      });

      await sleep(50);

      const result = await withTimeout(settled());
      expect(result).toBe('RESOLVED');

      expect(rejections.length).toBeGreaterThanOrEqual(1);
      expect((rejections[0] as Error).message).toBe('batch-boom');

      unsub();
    });
  });
});
