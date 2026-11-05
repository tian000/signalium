import { ConfigAPI } from '@babel/core';

export const isBabelApi = (value: unknown): value is ConfigAPI =>
  !!value && typeof value === 'object' && 'types' in value;

// Clone any user-supplied RegExp so its `lastIndex` state can't leak across
// files/plugins. The `g` and `y` flags make `RegExp.prototype.test` stateful
// (a successful match advances `lastIndex`, a failed one resets it to 0), which
// would otherwise make import matching depend on the order files are compiled
// and on the content of previously compiled files. Source-only matching
// semantics are intended here: the same import string must always match.
const toStatelessMatcher = (p: string | RegExp): string | RegExp =>
  typeof p === 'string' ? p : new RegExp(p.source, p.flags.replace(/[gy]/g, ''));

export const createTransformedImports = (
  defaultImports: [string, (string | RegExp)[]][],
  additionalImports?: [string, string | RegExp][],
  globalImportPaths?: (string | RegExp)[],
) => {
  if (globalImportPaths) {
    const sanitized = globalImportPaths.map(toStatelessMatcher);
    defaultImports.forEach(([name, paths]) => {
      paths.push(...sanitized);
    });
  }

  const transformedImports = new Map(defaultImports);

  if (additionalImports && additionalImports.length > 0) {
    for (const [name, path] of additionalImports) {
      const sanitized = toStatelessMatcher(path);
      const existing = transformedImports.get(name);
      if (existing) {
        existing.push(sanitized);
      } else {
        transformedImports.set(name, [sanitized]);
      }
    }
  }

  return transformedImports;
};
