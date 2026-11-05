import { describe, expect, test } from 'vitest';
import { context, getContext, withContexts, signal, reactive } from '../index.js';
import { useContext } from '../react/context.js';

describe('useContext with withContexts overrides', () => {
  test('useContext honors withContexts override', () => {
    const ctx = context('default');

    const result = withContexts([[ctx, 'override']], () => useContext(ctx));
    expect(result).toBe('override');
  });

  test('getContext and useContext agree inside withContexts', () => {
    const ctx = context('default');

    const result = withContexts([[ctx, 'override']], () => `${getContext(ctx)}|${useContext(ctx)}`);
    expect(result).toBe('override|override');
  });

  test('useContext without withContexts returns the default value', () => {
    const ctx = context('default');

    const derived = reactive(() => useContext(ctx));
    expect(derived()).toBe('default');
  });

  test('useContext returns to default after withContexts block ends', () => {
    const ctx = context('default');

    const derived = reactive(() => {
      const inside = withContexts([[ctx, 'override']], () => useContext(ctx));
      const outside = useContext(ctx);
      return `${inside}|${outside}`;
    });
    expect(derived()).toBe('override|default');
  });
});
