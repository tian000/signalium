#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('wrote', path.relative(pkgRoot, filePath));
}

// Generate ESM re-export wrappers for legacy entry points.
// The package root has `"type": "module"`, so `.js` files here are parsed as ESM.
// Emitting CJS (`exports`/`require`) into these `.js` files crashes Node with
// `ReferenceError: exports is not defined in ES module scope`. Use ESM re-exports
// so the wrappers load correctly under Node, bundlers, and node10-style TS.
// These point to production builds by default.
function makeReexportWrapper(importPath) {
  return `export * from '${importPath}';\n`;
}

// Generate .d.ts wrappers that re-export types from ESM declarations
function makeTypeReexportWrapper(importPath) {
  return `export * from '${importPath}';\n`;
}

// Generate for all entries consistently - pointing to production builds
write(path.join(pkgRoot, 'react.js'), makeReexportWrapper('./dist/esm/production/react/index.js'));
write(path.join(pkgRoot, 'react-server.js'), makeReexportWrapper('./dist/esm/production/react/index.server.js'));
write(path.join(pkgRoot, 'transform.js'), makeReexportWrapper('./dist/esm/production/transform/index.js'));
write(path.join(pkgRoot, 'debug.js'), makeReexportWrapper('./dist/esm/production/debug.js'));
write(path.join(pkgRoot, 'utils.js'), makeReexportWrapper('./dist/esm/production/utils.js'));
write(path.join(pkgRoot, 'config.js'), makeReexportWrapper('./dist/esm/production/config.js'));

// Write package.json to CJS directories to mark them as CommonJS
const cjsPackageJson = JSON.stringify({ type: 'commonjs' }, null, 2) + '\n';
write(path.join(pkgRoot, 'dist/cjs/production/package.json'), cjsPackageJson);
write(path.join(pkgRoot, 'dist/cjs/development/package.json'), cjsPackageJson);

// Type re-export wrappers for legacy entry points (shared types in dist/esm)
write(path.join(pkgRoot, 'index.d.ts'), makeTypeReexportWrapper('./dist/esm/index.js'));
write(path.join(pkgRoot, 'react.d.ts'), makeTypeReexportWrapper('./dist/esm/react/index.js'));
write(path.join(pkgRoot, 'react-server.d.ts'), makeTypeReexportWrapper('./dist/esm/react/index.server.js'));
write(path.join(pkgRoot, 'transform.d.ts'), makeTypeReexportWrapper('./dist/esm/transform/index.js'));
write(path.join(pkgRoot, 'debug.d.ts'), makeTypeReexportWrapper('./dist/esm/debug.js'));
write(path.join(pkgRoot, 'utils.d.ts'), makeTypeReexportWrapper('./dist/esm/utils.js'));
write(path.join(pkgRoot, 'config.d.ts'), makeTypeReexportWrapper('./dist/esm/config.js'));

console.log('Legacy entries generated.');
