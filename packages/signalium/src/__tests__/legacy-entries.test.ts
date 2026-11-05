import { describe, expect, test } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = join(pkgRoot, 'scripts', 'generate-legacy-entries.cjs');

const LEGACY_JS_WRAPPERS = ['react.js', 'react-server.js', 'transform.js', 'debug.js', 'utils.js', 'config.js'];

const LEGACY_DTS_WRAPPERS = [
  'index.d.ts',
  'react.d.ts',
  'react-server.d.ts',
  'transform.d.ts',
  'debug.d.ts',
  'utils.d.ts',
  'config.d.ts',
];

function readPkgRoot(relativePath: string): string {
  return readFileSync(join(pkgRoot, relativePath), 'utf8');
}

function runGenerator() {
  execSync(`node "${scriptPath}"`, { cwd: pkgRoot, stdio: 'pipe' });
}

describe('legacy entry wrappers', () => {
  test('generator script exists and runs', () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(() => runGenerator()).not.toThrow();
  });

  describe('JS wrappers are ESM (not CJS)', () => {
    for (const file of LEGACY_JS_WRAPPERS) {
      test(`${file} uses ESM export syntax, not CJS exports/require`, () => {
        runGenerator();
        const content = readPkgRoot(file);
        expect(content).toMatch(/^export \* from /);
        expect(content).not.toContain('exports');
        expect(content).not.toMatch(/\brequire\(/);
      });
    }
  });

  describe('all .d.ts wrappers are generated', () => {
    for (const file of LEGACY_DTS_WRAPPERS) {
      test(`${file} exists and re-exports types`, () => {
        runGenerator();
        const content = readPkgRoot(file);
        expect(content).toMatch(/^export \* from /);
      });
    }
  });

  describe('react-server targets the react-server export condition (server component)', () => {
    test('react-server.js points to index.server, not server', () => {
      runGenerator();
      const js = readPkgRoot('react-server.js');
      expect(js).toContain('index.server.js');
      expect(js).not.toMatch(/react\/server\.js/);
    });

    test('react-server.d.ts points to index.server, not server', () => {
      runGenerator();
      const dts = readPkgRoot('react-server.d.ts');
      expect(dts).toContain('index.server.js');
      expect(dts).not.toMatch(/react\/server\.js/);
    });
  });

  describe('package.json publishes all legacy wrappers', () => {
    const pkg = JSON.parse(readPkgRoot('package.json')) as { files: string[]; types?: string };

    test('files array includes every .d.ts wrapper', () => {
      for (const dts of LEGACY_DTS_WRAPPERS) {
        expect(pkg.files).toContain(dts);
      }
    });

    test('files array includes every .js wrapper', () => {
      for (const js of LEGACY_JS_WRAPPERS) {
        expect(pkg.files).toContain(js);
      }
    });

    test('has a top-level types field for node10 resolution', () => {
      expect(pkg.types).toBeDefined();
      expect(pkg.types).toBe('./index.d.ts');
    });
  });

  describe('wrappers load without crashing and export the correct API', () => {
    const distExists = existsSync(join(pkgRoot, 'dist', 'esm', 'production'));

    test.skipIf(!distExists)('all JS wrappers can be dynamically imported', async () => {
      runGenerator();
      for (const file of LEGACY_JS_WRAPPERS) {
        const filePath = join(pkgRoot, file);
        const mod = await import(filePath);
        expect(Object.keys(mod).length).toBeGreaterThan(0);
      }
    });

    test.skipIf(!distExists)('react.js exports component (client)', async () => {
      const mod = await import(join(pkgRoot, 'react.js'));
      expect(typeof mod.component).toBe('function');
      expect(mod.ContextProvider).toBeDefined();
    });

    test.skipIf(!distExists)('react-server.js exports component (server), not setupRscRequestScope', async () => {
      const mod = await import(join(pkgRoot, 'react-server.js'));
      expect(typeof mod.component).toBe('function');
      expect(mod.setupRscRequestScope).toBeUndefined();
    });

    test.skipIf(!distExists)('transform.js exports signaliumPreset', async () => {
      const mod = await import(join(pkgRoot, 'transform.js'));
      expect(typeof mod.signaliumPreset).toBe('function');
    });

    test.skipIf(!distExists)('config.js exports setConfig', async () => {
      const mod = await import(join(pkgRoot, 'config.js'));
      expect(typeof mod.setConfig).toBe('function');
    });
  });

  describe('CJS dist directories have type: commonjs', () => {
    test('dist/cjs/production/package.json has type commonjs', () => {
      runGenerator();
      const content = readPkgRoot('dist/cjs/production/package.json');
      expect(JSON.parse(content)).toEqual({ type: 'commonjs' });
    });

    test('dist/cjs/development/package.json has type commonjs', () => {
      runGenerator();
      const content = readPkgRoot('dist/cjs/development/package.json');
      expect(JSON.parse(content)).toEqual({ type: 'commonjs' });
    });
  });

  describe('no CJS-syntax wrappers remain at the package root', () => {
    test('root .js files do not contain Object.defineProperty(exports, ...)', () => {
      runGenerator();
      const rootFiles = readdirSync(pkgRoot).filter(f => f.endsWith('.js'));
      for (const file of rootFiles) {
        const content = readPkgRoot(file);
        expect(content).not.toContain('Object.defineProperty(exports,');
        expect(content).not.toContain('__esModule');
      }
    });
  });
});
