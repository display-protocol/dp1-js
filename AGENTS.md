# AGENTS.md - dp1-js

Top-level repo contract for coding agents.

## Purpose

This repository is the **Node.js SDK for [DP-1](https://github.com/display-protocol/dp1)**, rewritten from `dp1-go` while keeping the repo structure, test intent, and module boundaries aligned with the Go implementation.

**Non-goals:** Implementing a full player, renderer, or license server. This library supplies parsing, validation, canonicalization, signing primitives, and merge helpers consistent with DP-1.

**Universal runtime.** One build must load on Node, browsers, and Cloudflare Workers. That means no `node:*` imports, no `Buffer`/`process` globals, and no runtime schema compilation (`new Function`/`eval`) on any path reachable from the public API. Use `src/runtime/*` for bytes, IP predicates, and DNS. ESLint enforces the imports and globals; `tests/package.test.ts` enforces the built output; `npm run smoke:workerd` and `npm run smoke:browser` prove the two non-Node targets.

## Coding defaults

- Prefer the simplest change that preserves correctness and debuggability.
- Avoid silent failure paths; errors should be explicit and actionable.
- Treat tests, docs, workflows, and editor rules as part of the same change.
- Keep dependencies minimal. Prefer built-in Node APIs unless a third-party dependency materially improves correctness.

## Repo rules

- Preserve the Go-style layout when adding modules.
- Keep `README.md`, GitHub workflow files, and `.cursor/rules/` in sync with the JS API.
- Keep validation and canonicalization semantics stable once public.
- Add tests for behavior changes, especially around canonicalization, parsing, and signature handling.

## Verification

Before considering work complete:

```bash
npm run lint
npm run type-check
npm test
```

A Node suite cannot catch a runtime regression — `new Function` is legal in Node and `node:*` resolves natively. When a change touches `src/runtime/`, signing, or validation, also run:

```bash
npm run smoke:workerd   # workerd, deliberately without nodejs_compat
npm run smoke:browser   # Chromium under script-src 'self' (needs Playwright)
```

If a change touches signing or canonicalization, add regression tests for the exact payload shape and hash behavior.

Use `npm run build` when distribution output or packaging changes.

## Portable operating model

Default sequence:

`spec → design → tasks → tests → implementation → verification → review → merge`

For small, low-risk fixes the sequence can compress, but work stays scoped, verified, and traceable.

## Issues and PRs

- Before starting work on an issue, check it for linked PRs, branches, or an assignee. If someone is already on it, coordinate there instead of opening a duplicate.
- When opening a PR, link the tracking issue in the description (`Closes #N`). If there is no issue, say so in the PR body.

## Definition of done

A task is complete only when:

1. The requested change is implemented.
2. Relevant tests were added or updated, or an explicit reason is given when none were appropriate.
3. Verification passes cleanly (lint, typecheck, tests).
4. Docs and `.cursor` rules are updated if user-facing API or agent workflow expectations changed.
5. Review has accepted the change (see Review loop).
6. The branch is merge-ready without hidden follow-up work.

## Review loop

After implementation, run a review loop before merge or release preparation.

1. Create a compact handoff with goal, scope, files changed, key decisions, checks run, and known limitations.
2. Run a fresh-context review using the shared contract in `prompts/code-review.md`.
3. Provide `git diff --stat`, full `git diff`, and lint/test output when practical.
4. If review returns `Verdict: revise`, address findings, re-run verification, update the handoff, and review again.
5. Only proceed to commit, push, or PR when the reviewer returns `Verdict: accept`.

**Tool mappings**

- Cursor reviewer agent: `.cursor/agents/reviewer.md`
- OpenCode reviewer (optional): `opencode.json` command `review`
- Claude Code: `CLAUDE.md` imports this file; no separate rules

## Authoritative tool-specific files

- Claude Code entrypoint: `CLAUDE.md` (imports `AGENTS.md`)
- Cursor rules: `.cursor/rules/`
- Cursor sub-agents: `.cursor/agents/`
- Shared review prompt: `prompts/code-review.md`
- OpenCode config (optional): `opencode.json`
