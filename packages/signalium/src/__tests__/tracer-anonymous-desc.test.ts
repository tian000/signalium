import { describe, expect, test, afterEach } from 'vitest';
import { signal, reactive, reactiveSignal, watcher, relay } from '../index.js';
import { setTracing, createTracer, TracerEventType, SignalType } from '../debug.js';
import { getUnknownSignalFnName } from '../internals/utils/debug-name.js';

afterEach(() => {
  setTracing(false);
});

describe('tracerMeta.desc naming', () => {
  describe('reactiveSignal', () => {
    test('anonymous arrow gets a generated unknownSignal name, not empty string', () => {
      const s = reactiveSignal(() => 42) as any;
      expect(s.tracerMeta.desc).not.toBe('');
      expect(s.tracerMeta.desc).toMatch(/^unknownSignal\d+$/);
    });

    test('named function uses the function name as desc', () => {
      function namedFn() {
        return 42;
      }
      const s = reactiveSignal(namedFn) as any;
      expect(s.tracerMeta.desc).toBe('namedFn');
    });

    test('explicit desc is used verbatim', () => {
      const s = reactiveSignal(() => 42, { desc: 'my-signal' }) as any;
      expect(s.tracerMeta.desc).toBe('my-signal');
    });

    test('explicit empty desc falls through to generated name', () => {
      const s = reactiveSignal(() => 42, { desc: '' }) as any;
      expect(s.tracerMeta.desc).not.toBe('');
      expect(s.tracerMeta.desc).toMatch(/^unknownSignal\d+$/);
    });
  });

  describe('watcher', () => {
    test('anonymous watcher gets a generated unknownSignal name', () => {
      const w = watcher(() => 42) as any;
      expect(w.tracerMeta.desc).not.toBe('');
      expect(w.tracerMeta.desc).toMatch(/^unknownSignal\d+$/);
    });

    test('named watcher uses the function name as desc', () => {
      function namedWatcher() {
        return 42;
      }
      const w = watcher(namedWatcher) as any;
      expect(w.tracerMeta.desc).toBe('namedWatcher');
    });

    test('watcher with explicit desc uses it verbatim', () => {
      const w = watcher(() => 42, { desc: 'my-watcher' }) as any;
      expect(w.tracerMeta.desc).toBe('my-watcher');
    });
  });

  describe('relay', () => {
    test('relay without desc has a non-empty desc (compute property name)', () => {
      // createRelay defines `compute: () => {...}` directly in the object
      // literal, so JS named-property assignment gives fn.name === 'compute'.
      // This was never affected by the empty-name bug (only functions passed
      // as parameters with fn.name === '' were).
      const r = relay<unknown>(() => undefined) as any;
      expect(r._signal.tracerMeta.desc).not.toBe('');
      expect(r._signal.tracerMeta.desc).toBe('compute');
    });

    test('relay with explicit desc uses it verbatim', () => {
      const r = relay<unknown>(() => undefined, { desc: 'my-relay' }) as any;
      expect(r._signal.tracerMeta.desc).toBe('my-relay');
    });
  });
});

describe('getUnknownSignalFnName', () => {
  test('returns a name matching unknownSignal<N> format', () => {
    const name = getUnknownSignalFnName(() => {});
    expect(name).toMatch(/^unknownSignal\d+$/);
  });

  test('returns the same name for the same function object', () => {
    const fn = () => {};
    const name1 = getUnknownSignalFnName(fn);
    const name2 = getUnknownSignalFnName(fn);
    expect(name1).toBe(name2);
  });

  test('returns different names for different function objects', () => {
    const name1 = getUnknownSignalFnName(() => {});
    const name2 = getUnknownSignalFnName(() => {});
    expect(name1).not.toBe(name2);
  });
});

describe('Tracer integration', () => {
  test('anonymous reactive consumed by watcher appears in tracer nodeMap', () => {
    setTracing(true);
    const state = signal(1);
    const anon = reactive((x: number) => x + 1);
    const w = watcher(() => anon(state.value));
    const tracer = createTracer(w as any, true);

    const unsub = w.addListener(() => {});
    expect(w.value).toBe(2);

    const children = (tracer as any).rootNode.children as any[];
    const childNames = children.map(c => c.node.name);

    expect(childNames.some(n => /^unknownSignal\d+$/.test(n))).toBe(true);

    unsub();
  });

  test('named reactive consumed by watcher appears in tracer nodeMap with its name', () => {
    setTracing(true);
    const state = signal(1);
    function namedReactive(x: number) {
      return x + 1;
    }
    const named = reactive(namedReactive);
    const w = watcher(() => named(state.value));
    const tracer = createTracer(w as any, true);

    const unsub = w.addListener(() => {});
    expect(w.value).toBe(2);

    const children = (tracer as any).rootNode.children as any[];
    const childNames = children.map(c => c.node.name);

    expect(childNames).toContain('namedReactive');

    unsub();
  });

  test('cascade: child consumed only through anonymous parent appears in tracer', () => {
    setTracing(true);
    const state = signal(1);
    const anon = reactive((x: number) => x + 1);
    function namedChild(x: number) {
      return x * 2;
    }
    const child = reactive(namedChild);
    const w = watcher(() => child(anon(state.value)));
    const tracer = createTracer(w as any, true);

    const unsub = w.addListener(() => {});
    expect(w.value).toBe(4);

    const nodeMap = (tracer as any).nodeMap as Map<string | number, any>;
    const allNames = Array.from(nodeMap.values()).map((n: any) => n.name);

    expect(allNames.some(n => /^unknownSignal\d+$/.test(n))).toBe(true);
    expect(allNames).toContain('namedChild');

    unsub();
  });

  test('state signal consumed within anonymous reactive appears in tracer', () => {
    setTracing(true);
    const state = signal(42);
    const anon = reactive((x: number) => x);
    const w = watcher(() => anon(state.value));
    const tracer = createTracer(w as any, true);

    const unsub = w.addListener(() => {});
    expect(w.value).toBe(42);

    const nodeMap = (tracer as any).nodeMap as Map<string | number, any>;
    const stateNodes = Array.from(nodeMap.values()).filter((n: any) => n.type === SignalType.State);
    expect(stateNodes.length).toBeGreaterThan(0);

    unsub();
  });

  test('reactiveSignal with explicit desc appears in tracer with that desc', () => {
    setTracing(true);
    const s = signal(1);
    const derived = reactiveSignal(() => s.value * 2, { desc: 'doubled' });
    const w = watcher(() => derived.value);
    const tracer = createTracer(w as any, true);

    const unsub = w.addListener(() => {});
    expect(w.value).toBe(2);

    const children = (tracer as any).rootNode.children as any[];
    const childNames = children.map(c => c.node.name);
    expect(childNames).toContain('doubled');

    unsub();
  });
});

describe('Tracer.emit defensive behavior', () => {
  test('Connected event with empty name still creates a node with fallback name', () => {
    setTracing(true);
    const w = watcher(() => 42) as any;
    const tracer = createTracer(w as any, true);

    tracer.emit({
      type: TracerEventType.Connected,
      id: w.tracerMeta.id,
      childId: 'test-child-empty',
      name: '',
      params: '',
      nodeType: SignalType.Reactive,
    });

    const nodeMap = (tracer as any).nodeMap as Map<string | number, any>;
    expect(nodeMap.has('test-child-empty')).toBe(true);
    const child = nodeMap.get('test-child-empty');
    expect(child.name).toBe('test-child-empty');
  });

  test('Connected event with undefined name still creates a node with fallback name', () => {
    setTracing(true);
    const w = watcher(() => 42) as any;
    const tracer = createTracer(w as any, true);

    tracer.emit({
      type: TracerEventType.Connected,
      id: w.tracerMeta.id,
      childId: 'test-child-undef',
      name: undefined,
      params: undefined,
      nodeType: SignalType.Reactive,
    });

    const nodeMap = (tracer as any).nodeMap as Map<string | number, any>;
    expect(nodeMap.has('test-child-undef')).toBe(true);
    const child = nodeMap.get('test-child-undef');
    expect(child.name).toBe('test-child-undef');
  });

  test('Connected event with non-empty name uses the provided name', () => {
    setTracing(true);
    const w = watcher(() => 42) as any;
    const tracer = createTracer(w as any, true);

    tracer.emit({
      type: TracerEventType.Connected,
      id: w.tracerMeta.id,
      childId: 'test-child-named',
      name: 'provided-name',
      params: '',
      nodeType: SignalType.Reactive,
    });

    const nodeMap = (tracer as any).nodeMap as Map<string | number, any>;
    expect(nodeMap.has('test-child-named')).toBe(true);
    const child = nodeMap.get('test-child-named');
    expect(child.name).toBe('provided-name');
  });
});
