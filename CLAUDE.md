# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GitHub Action that lints all commits in a Pull Request against the [Conventional Commits](https://www.conventionalcommits.org/) specification. It posts a summary comment on the PR with per-commit results, error/warning counts, and remediation tips.

## Commands

```bash
npm run build    # Bundle index.js → dist/index.js using @zeit/ncc
npm run lint     # ESLint
npm run release  # Bump version, tag, and publish (runs build first)
```

There is no automated test suite. Functional testing happens via `.github/workflows/test.yml`, which runs the action against itself on each PR.

## Architecture

**Single entry point:** `index.js` — one async `run()` function (~250 lines). The built output is `dist/index.js` (bundled with all dependencies).

**Code flow:**
1. Read GitHub Action inputs (`token`, `config_path`, `rules`, `comment`, `delete_comment`)
2. Load commitlint rules: merge `@commitlint/config-conventional` defaults → `.github/prcolinterrc.json` → inline `rules` input
3. Authenticate Octokit, extract PR context from `github.context`; abort if event is not `pull_request`
4. Fetch all commits in the PR via REST API
5. Lint each commit message with `@commitlint/lint` (parallel via `Promise.all`)
6. If `delete_comment=true`: paginate through PR comments and delete previous lint reports
7. If `comment=true`: post a new consolidated comment with per-commit results, stats, and fix guidance
8. If any errors found: call `core.setFailed()`

**Key dependencies:**
- `@actions/core` / `@actions/github` — GitHub Actions SDK
- `@commitlint/lint` + `@commitlint/config-conventional` — commit validation
- `moment` — human-readable timestamps in comment output

**Action metadata:** `action.yml` declares inputs/outputs and points the runtime to `dist/index.js` (Node 12).

**Default config:** `.github/prcolinterrc.json` in the consuming repo. The action's own repo uses one at `.github/prcolinterrc.json` that disables `body-max-line-length` and `references-empty`.

## Coding Style

- Plain JavaScript (no TypeScript, no build transpilation beyond bundling)
- 2-space indent, single quotes, semicolons required
- `eqeqeq` enforced; `prefer-const` enforced
- Max line length 200 (comments excluded)
- ESLint config in `.eslintrc`
