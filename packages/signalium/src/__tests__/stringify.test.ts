import { describe, expect, test } from 'vitest';
import { stringifyValue } from '../internals/utils/stringify.js';
import { reactive } from '../index.js';

describe('stringifyValue', () => {
  describe('cycle detection', () => {
    test('self-referential object does not stack overflow and emits a stable marker', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      expect(() => stringifyValue(obj)).not.toThrow();
      expect(stringifyValue(obj)).toBe('{ self: [Circular: 0] }');
      expect(stringifyValue(obj)).toBe(stringifyValue(obj));
    });

    test('self-referential array does not stack overflow and emits a stable marker', () => {
      const arr: unknown[] = [];
      arr.push(arr);
      expect(() => stringifyValue(arr)).not.toThrow();
      expect(stringifyValue(arr)).toBe('[[Circular: 0]]');
      expect(stringifyValue(arr)).toBe(stringifyValue(arr));
    });

    test('mutually referential objects do not stack overflow', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = { ref: a };
      a.ref = b;
      expect(() => stringifyValue(a)).not.toThrow();
      expect(stringifyValue(a)).toBe('{ ref: { ref: [Circular: 0] } }');
    });

    test('cycle inside an array does not stack overflow', () => {
      const inner: Record<string, unknown> = {};
      inner.self = inner;
      expect(() => stringifyValue([inner, inner])).not.toThrow();
    });

    test('deeply nested cycle emits the correct depth index', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      const c: Record<string, unknown> = {};
      a.b = b;
      b.c = c;
      c.a = a;
      // a (index 0) -> b (index 1) -> c (index 2) -> a (cycle back to 0)
      expect(stringifyValue(a)).toBe('{ b: { c: { a: [Circular: 0] } } }');
    });

    // A shared reference between siblings is NOT a cycle because the node is
    // popped from `seen` after each sibling is processed. If the pop is
    // removed, the second reference would be mislabeled as a cycle.
    test('sibling references to the same object are not treated as cycles', () => {
      const shared = { x: 1 };
      const withSiblings = { a: shared, b: shared };
      expect(stringifyValue(withSiblings)).toBe('{ a: { x: 1 }, b: { x: 1 } }');
    });

    test('sibling references to the same array are not treated as cycles', () => {
      const shared = [1];
      const withSiblings = { a: shared, b: shared };
      expect(stringifyValue(withSiblings)).toBe('{ a: [1], b: [1] }');
    });
  });

  describe('dev-mode tracer integration', () => {
    // The ReactiveSignal constructor stringifies every arg to build tracerMeta.params.
    // Circular args must not crash the call site (the original bug).
    test('reactive function with a self-referential object arg does not throw', () => {
      const fn = reactive((obj: { x: number; self?: unknown }) => obj.x);
      const obj: { x: number; self?: unknown } = { x: 1 };
      obj.self = obj;
      expect(() => fn(obj)).not.toThrow();
      expect(fn(obj)).toBe(1);
    });

    test('reactive function with a self-referential array arg does not throw', () => {
      const fn = reactive((arr: number[]) => arr[0]);
      const arr: unknown[] = [1];
      arr.push(arr);
      expect(() => fn(arr as number[])).not.toThrow();
    });

    test('reactive function with mutually referential object args does not throw', () => {
      const fn = reactive((a: { ref: unknown }) => a);
      const a: { ref: unknown } = { ref: null };
      const b: { ref: unknown } = { ref: a };
      a.ref = b;
      expect(() => fn(a)).not.toThrow();
    });
  });
});
