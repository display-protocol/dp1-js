# dp1-js Review Delta

Apply these repository-specific checks in addition to `prompts/code-review.md`:

- Preserve DP-1 behavior and intended `dp1-go` parity for parsing, validation, canonicalization, merge, and signing.
- Require regression coverage for behavior changes, especially exact canonicalization and signature payload/hash behavior.
- Check public API documentation when observable behavior changes.
- Use `npm run lint`, `npm run type-check`, and `npm test`; also use `npm run build` when packaging or distribution output changes.
