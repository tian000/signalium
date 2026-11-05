import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { signaliumAsyncTransform } from '../index.js';

function normalize(code: string): string {
  return code.trim().replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
}

function runTransform(input: string, opts?: unknown): string {
  const res = transformSync(input, {
    ast: false,
    code: true,
    sourceMaps: false,
    plugins: [signaliumAsyncTransform((opts as any) ?? undefined)],
    parserOpts: { plugins: ['typescript'] },
    generatorOpts: { decoratorsBeforeExport: true, comments: false, compact: false, retainLines: false },
    filename: 'fixture.ts',
  });
  if (!res || !res.code) throw new Error('Transform produced no code');
  return res.code;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, '__fixtures__/transforms/async');

describe('signaliumAsyncTransform', () => {
  const cases = fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const name of cases) {
    it(name, () => {
      const dir = path.join(fixturesRoot, name);
      const before = fs.readFileSync(path.join(dir, 'before.ts'), 'utf8');
      const after = fs.readFileSync(path.join(dir, 'after.ts'), 'utf8');
      const optionsPath = path.join(dir, 'options.json');
      const opts = fs.existsSync(optionsPath) ? JSON.parse(fs.readFileSync(optionsPath, 'utf8') || '{}') : undefined;
      const output = runTransform(before, opts);

      expect(normalize(output)).toEqual(normalize(after));
    });
  }
});

describe('signaliumAsyncTransform - for await', () => {
  it('throws a helpful error for `for await` in a reactive async arrow function', () => {
    const input = `
import { reactive } from 'signalium';
const f = reactive(async () => {
  for await (const x of xs) {
    out.push(x);
  }
});
`;
    expect(() => runTransform(input)).toThrow(/for await/);
  });

  it('throws a helpful error for `for await` in a reactive async function expression', () => {
    const input = `
import { reactive } from 'signalium';
const f = reactive(async function () {
  for await (const x of xs) {
    out.push(x);
  }
});
`;
    expect(() => runTransform(input)).toThrow(/for await/);
  });

  it('throws a helpful error for `for await` in a task async function', () => {
    const input = `
import { task } from 'signalium';
const f = task(async () => {
  for await (const x of xs) {
    out.push(x);
  }
});
`;
    expect(() => runTransform(input)).toThrow(/for await/);
  });

  it('error message mentions reactive functions and suggests alternatives', () => {
    const input = `
import { reactive } from 'signalium';
const f = reactive(async () => {
  for await (const x of xs) {}
});
`;
    expect(() => runTransform(input)).toThrow(/reactive|task|relay|callback/);
  });

  it('does not throw for `for await` outside of tracked calls', () => {
    const input = `
import { reactive } from 'signalium';
async function f() {
  for await (const x of xs) {
    out.push(x);
  }
}
`;
    const output = runTransform(input);
    expect(normalize(output)).toEqual(normalize(input));
  });

  it('does not throw for plain for/of loops in a reactive async function', () => {
    const input = `
import { reactive } from 'signalium';
const f = reactive(async () => {
  const items = await getItems();
  for (const item of items) {
    out.push(item);
  }
});
`;
    const output = runTransform(input);
    expect(output).toContain('function*');
    expect(output).toContain('yield getItems()');
    expect(output).toContain('for (const item of items)');
    expect(output).not.toContain('for await');
  });

  it('throws for `for await` even when an await expression precedes it', () => {
    const input = `
import { reactive } from 'signalium';
const f = reactive(async () => {
  await first();
  for await (const x of xs) {}
});
`;
    expect(() => runTransform(input)).toThrow(/for await/);
  });
});
