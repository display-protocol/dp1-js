/**
 * Runtime support for the precompiled validators in `./generated/validators.js`.
 *
 * The generated code is plain JavaScript — it never compiles a schema — but it still needs
 * the format implementations and the couple of helper functions Ajv would otherwise inline
 * via `require(...)`. Keeping them behind this module means the generated file has a single,
 * bundler-friendly import and the package ships no runtime Ajv dependency.
 */
import { fullFormats } from 'ajv-formats/dist/formats.js';

/** Format map keyed exactly as the generated code indexes it (`formats["date-time"]`). */
export const formats = fullFormats;

/**
 * Unicode code point count, the length JSON Schema's `minLength` / `maxLength` are defined
 * over. Implemented here rather than imported from `ajv/dist/runtime/ucs2length.js`: that
 * module is CommonJS with a `default` export, and under Node ESM semantics a default import
 * yields `module.exports` instead of the function, which only shows up once the package is
 * bundled.
 */
export function ucs2length(str: string): number {
  let length = 0;
  for (let i = 0; i < str.length; i++, length++) {
    const code = str.charCodeAt(i);
    // A well-formed surrogate pair is one code point; a lone surrogate counts as one too.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
  }
  return length;
}

// Helpers are added here only as the schemas start needing them: the generator fails the
// build when it emits a `require(...)` for one that is not mapped and re-exported.
