import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { signaliumPreset, signaliumAsyncTransform } from '../index.js';

function normalize(code: string): string {
  return code.trim().replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
}

function runPreset(input: string, presets: any[], plugins?: any[]): string {
  const res = transformSync(input, {
    ast: false,
    code: true,
    sourceMaps: false,
    presets,
    plugins,
    parserOpts: { plugins: ['typescript'] },
    generatorOpts: { decoratorsBeforeExport: true, comments: false, compact: false, retainLines: false },
    filename: 'fixture.ts',
  });
  if (!res || !res.code) throw new Error('Transform produced no code');
  return res.code;
}

// Source that exercises every transform: async->generator (async), callback
// wrapping (callback), useReactive memoization (use-reactive), and Promise
// static method rewriting (promise). All four plugins share the same
// user-supplied regex objects via the preset's options.
const source = `
import { reactive } from 'signalium/react';
import { useReactive } from 'signalium/react';

const inner = reactive(async () => {
  await Promise.resolve();
  return 'inner-value';
});

export function useThing() {
  return useReactive(() => 1 + 2);
}
`;

// Source for the single-plugin variant: a plain arrow whose check MATCHES and
// would poison lastIndex for the subsequent async arrow that must be converted.
const sourceWithPlainArrow = `
import { reactive } from 'signalium/react';

const plain = reactive(() => 1 + 2);

const asyncFn = reactive(async () => {
  await Promise.resolve();
  return 'value';
});
`;

describe('regex statefulness (g/y flags)', () => {
  it('importPaths with g flag transforms every file identically across many compiles', () => {
    // The baseline (unflagged) output is the correct, fully-transformed result.
    const baseline = normalize(runPreset(source, [signaliumPreset({ importPaths: [/signalium\/react/] })]));
    const presets = [signaliumPreset({ importPaths: [/signalium\/react/g] })];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(source, presets))).toEqual(baseline);
    }
  });

  it('importPaths with y flag transforms every file identically across many compiles', () => {
    const baseline = normalize(runPreset(source, [signaliumPreset({ importPaths: [/signalium\/react/] })]));
    const presets = [signaliumPreset({ importPaths: [/signalium\/react/y] })];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(source, presets))).toEqual(baseline);
    }
  });

  it('transformedImports with g flag transforms every file identically across many compiles', () => {
    const baseline = normalize(
      runPreset(source, [
        signaliumPreset({
          transformedImports: [
            ['reactive', /signalium\/react/],
            ['useReactive', /signalium\/react/],
          ],
        }),
      ]),
    );
    const presets = [
      signaliumPreset({
        transformedImports: [
          ['reactive', /signalium\/react/g],
          ['useReactive', /signalium\/react/g],
        ],
      }),
    ];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(source, presets))).toEqual(baseline);
    }
  });

  it('a single shared regex instance is not mutated across files/plugins', () => {
    // The same regex object is passed to all four plugins via the preset; its
    // lastIndex must remain 0 after every compile (no state leakage).
    const re = /signalium\/react/g;
    const baseline = normalize(runPreset(source, [signaliumPreset({ importPaths: [/signalium\/react/] })]));
    const presets = [signaliumPreset({ importPaths: [re] })];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(source, presets))).toEqual(baseline);
      expect(re.lastIndex).toEqual(0);
    }
  });

  it('async-only transform with g flag converts every file (no silent skip)', () => {
    const baseline = normalize(
      runPreset(
        sourceWithPlainArrow,
        [],
        [signaliumAsyncTransform({ transformedImports: [['reactive', /signalium\/react/]] })],
      ),
    );
    const plugins = [signaliumAsyncTransform({ transformedImports: [['reactive', /signalium\/react/g]] })];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(sourceWithPlainArrow, [], plugins))).toEqual(baseline);
    }
  });

  it('string importPaths still match (no regression)', () => {
    const baseline = normalize(runPreset(source, [signaliumPreset({ importPaths: [/signalium\/react/] })]));
    expect(normalize(runPreset(source, [signaliumPreset({ importPaths: ['signalium/react'] })]))).toEqual(baseline);
  });

  it('other regex flags (i) are preserved when stripping g/y', () => {
    const baseline = normalize(runPreset(source, [signaliumPreset({ importPaths: [/signalium\/react/] })]));
    // `i` flag should be retained; matching must still be stateless.
    const presets = [signaliumPreset({ importPaths: [/SIGNALIUM\/REACT/gi] })];
    for (let i = 0; i < 8; i++) {
      expect(normalize(runPreset(source, presets))).toEqual(baseline);
    }
  });
});
