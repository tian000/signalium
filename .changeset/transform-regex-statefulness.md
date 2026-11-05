---
'signalium': patch
---

Fix the Babel preset silently skipping transforms when `importPaths`/`transformedImports` regexes used the `g` or `y` flag. User-supplied `RegExp` objects were stored by reference and shared across all files compiled with one config, so `RegExp.prototype.test`'s `lastIndex` state leaked between files and plugins, making import matching depend on file-processing order. Regexes are now cloned without the `g`/`y` flags when building the match map, so matching is purely a function of the import string.
