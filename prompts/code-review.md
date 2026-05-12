# dp1-js Code Review Contract

Use this contract for fresh-context review after implementation.

## Review posture

- Prioritize correctness, behavioral regressions, alignment with DP-1 semantics, and missing verification over style nits.
- Assume the author acted in good faith. Review the change, not the person.
- Be explicit about risk. If something is uncertain, say why.
- Prefer concrete evidence from the diff, touched files, and command output.

## Review priorities

Check in this order:

1. Broken behavior, crashes, or incorrect parsing, validation, canonicalization, merge, or signing behavior
2. Regressions against DP-1 expectations or parity with `dp1-go` intent where this SDK mirrors it
3. Missing or weak tests for behavior changes (especially canonicalization and signatures)
4. Documentation gaps when the public API or observable behavior changed
5. Cleanup items that materially improve maintainability

## Required inputs

Reviewers should use, when available:

- handoff summary
- `git diff --stat`
- full `git diff`
- lint and test output (`npm run lint`, `npm test`; typecheck if relevant)

## Output format

Use these sections in order:

### Critical issues

- List high-severity correctness or regression findings.
- If none, write `- None.`

### Medium issues

- List moderate-risk issues, design mismatches, or notable omissions.
- If none, write `- None.`

### Missing tests

- List missing or insufficient tests tied to the change.
- If none, write `- None.`

### Optional cleanup

- List non-blocking cleanup ideas only if they are worth the reviewer and author time.
- If none, write `- None.`

### Verdict

- End with exactly one line:
  - `Verdict: accept`
  - `Verdict: revise`

## Acceptance bar

Return `Verdict: accept` only when:

- no blocking correctness issues remain
- verification looks sufficient for the scope
- tests are adequate for the changed behavior
- docs are updated when user-facing API or behavior changed

Otherwise return `Verdict: revise`.
