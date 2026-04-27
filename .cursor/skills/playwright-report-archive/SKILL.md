---
name: playwright-report-archive
description: Archive each Playwright test run into a timestamped history folder and auto-generate an index.html listing every past run with pass-rate, duration, and links to HTML/JSON reports. Use when a team needs run-to-run comparison, nightly/CI history, or auditable records of which tests passed on which date — instead of the default behavior of overwriting `playwright-report/` on every run.
author: Yash Trivedi
---

# playwright-report-archive

## Problem

By default, Playwright writes its HTML report to `playwright-report/` and overwrites it on the next run. You lose history. You can't answer "did TTS_DAS_09 pass on Apr 9?" or "when did this test start flaking?" without digging through CI logs — which are also often rotated.

## The pattern

After each test run, copy `reports/ui-test-results.json` + `playwright-html/` + `playwright/` artifacts into a **timestamped folder** under `reports/history/`, then regenerate a single `index.html` that lists all runs as rows in a table.

Folder layout:

```
reports/
├── ui-test-results.json      ← latest run (overwritten)
├── playwright-html/          ← latest run (overwritten)
└── history/
    ├── index.html            ← auto-generated list of all runs
    ├── 2026-04-06_07-46-38_initial-bug-hunt/
    │   ├── ui-test-results.json
    │   ├── playwright-html/
    │   ├── playwright/       (screenshots, traces)
    │   └── summary.json      ← {passed, failed, skipped, duration, label}
    ├── 2026-04-07_11-45-55_products-e2e/
    └── 2026-04-10_07-29-05/
```

## The script

See [scripts/archive-report.ts](../../scripts/archive-report.ts). It:

1. Parses the Playwright JSON report.
2. Walks suites/specs/tests recursively, counts `passed / failed / skipped / flaky`.
3. Copies report artifacts into a timestamped folder (with optional `--label`).
4. Writes `summary.json` for quick reads without re-parsing the big JSON.
5. Loads every prior `summary.json`, sorts by timestamp, and regenerates `reports/history/index.html` with a styled table.

## Commands

```bash
# Run tests, then archive
npm run test:ui:save

# Or manually
npm run test:ui
npx tsx scripts/archive-report.ts --label nightly

# Open the history dashboard
npm run report:history    # → xdg-open reports/history/index.html
```

The `:save` wrapper ([package.json](../../package.json)) chains run + archive in one step:

```json
"test:ui:save": "npm run test:ui; npm run report:archive",
"test:dashboard:all:save": "npm run test:dashboard:all; npm run report:archive -- --label dashboard-all"
```

## What the index shows

Each row = one run:

| Date / Time | Passed | Failed | Skipped | Total | Pass Rate | Duration | Status | Reports |
|---|---|---|---|---|---|---|---|---|
| Apr 10 07:29 | 83 | 3 | 36 | 122 | 96.5% | 240s | ✓ | HTML · JSON · Summary |

Links open the archived HTML report for that specific run — not the latest.

## Why this is non-obvious

- **Playwright has no built-in "history" concept.** The `playwright-report/` folder is just the latest artifact.
- **CI artifact upload ≠ history.** CI tools like GitHub Actions keep a zip per run, but you can't browse across runs or see trends without downloading each one.
- **`summary.json` per run** lets the index regenerate instantly — no re-parsing all the big HTML/JSON blobs.

## Porting to another repo

1. Copy [scripts/archive-report.ts](../../scripts/archive-report.ts) to your project's `scripts/` folder.
2. Check your `playwright.config.ts` JSON reporter path matches `reports/ui-test-results.json` (or edit the `REPORTS_DIR` constant in the script).
3. Add npm scripts:
   ```json
   "report:archive": "tsx scripts/archive-report.ts",
   "report:history": "xdg-open reports/history/index.html",
   "test:ui:save": "npm run test:ui; npm run report:archive"
   ```
4. First run: `npm run test:ui:save`. Open `reports/history/index.html` — one row so far.
5. Every future run with `:save` adds another row.

## Gotchas

- **Label must be filesystem-safe.** The script already strips non-alphanumeric chars (`/[^a-zA-Z0-9_-]/g`) — spaces become underscores.
- **Don't `git commit` the history folder.** Can grow large fast (each run = full HTML report + traces). Add `reports/history/` to `.gitignore`. If you need shared history, upload to cloud storage (S3/GCS) instead.
- **Timestamp collision.** If two runs start in the same second, same `runId` — the second overwrites the first. Use `--label` per parallel run, or add milliseconds to the timestamp format in `getRunId`.
- **`stats.startTime` / `stats.duration`** in the Playwright JSON report is only present on recent Playwright versions. The script falls back gracefully if missing.
