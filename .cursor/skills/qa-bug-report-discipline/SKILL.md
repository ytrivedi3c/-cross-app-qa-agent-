---
name: qa-bug-report-discipline
description: QA tester posture — find and report bugs, do not patch the app under test. Covers the bug-report template (severity, test case, steps, expected, actual, impact), when to stop debugging, how to flag cascade-blocked tests, and the boundary between "my test code" (mine to fix) vs "product code" (not mine to fix). Use when writing bug reports, triaging test failures, deciding whether a failure is a test bug or a product bug, or when the user mentions bug report, BUG-001, severity, or regression.
author: Yash Trivedi
---

# qa-bug-report-discipline

## Posture

**A QA tester finds bugs and reports them. They do NOT patch the product.**

The temptation to "just fix the typo in the frontend" is strong and almost always wrong:

- You bypass the process that catches the root cause (e.g. the typo was caused by a bad i18n key — fixing the display masks the key issue).
- You commit product code without the dev team's review cycle.
- You lose the evidence of a real defect that should be tracked.

**Allowed to modify:** test code (specs, POMs, fixtures, helpers, CI config).
**Not allowed to modify (even if trivial):** the app under test. In this repo that's everything under `automation-workspace/company-app/`.

The only exception: clear typos in test fixtures' seed data. When in doubt, file the bug.

## The bug-report template

Use the structured template from [docs/ui-bug-report.md](../../docs/ui-bug-report.md). One row per bug:

```markdown
### BUG-NNN: <one-line title summarizing the user-visible symptom>

| Field | Detail |
|-------|--------|
| **Severity** | Critical / High / Medium / Low |
| **Test Case** | TTS_DAS_09 (or PROD_E2E_22, etc.) |
| **Page** | Dashboard → Product Status section |
| **Steps to Reproduce** | 1. Step one. 2. Step two. 3. Observe X. |
| **Expected** | What the test-case expected |
| **Actual** | What the page actually showed |
| **Note** | Related context — e.g. other tabs work, or feature gates involved |
| **Impact** | User-facing impact + downstream tests blocked |
```

## Severity rubric

| Severity | Criteria | Example |
|---|---|---|
| **Critical** | Blocks core flow for all users; data loss risk | Login fails entirely; cart checkout returns 500 |
| **High** | Blocks a major flow for many users; no workaround | Multi-filter combo doesn't apply (BUG-001); bulk upload fails |
| **Medium** | Feature-level bug with workaround, or confusing UX | Wrong empty state copy; misleading label |
| **Low** | Cosmetic, edge case, or easy workaround | Tooltip cuts off; date formatting wrong |

**Pitfall:** don't inflate severity because a lot of tests cascaded from it. Report the cascade in the **Impact** field, but rate severity on user impact, not test impact.

## The cascade rule

In serial-mode suites (`test.describe.configure({ mode: "serial" })`), one failure blocks every subsequent test. You'll see reports like:

> Pass rate: 83/122 = 68% (36 skips are cascade from serial mode, not additional bugs)

**Always separate** cascade-blocked counts from real failures. The bug report should say:

> 12 downstream tests blocked due to serial mode — not 12 additional bugs.

Otherwise readers panic over an inflated count.

## When to stop debugging (as QA)

Rule of thumb: **if you can reliably reproduce the user-visible symptom in 2-3 clicks, stop and file the bug.** You don't need to:

- Find the root cause in the source code.
- Propose a fix.
- Attach a stack trace (unless it's in the browser console and non-obvious).

You DO need to:

- Confirm it's not a flaky test (run it 2-3 times).
- Note if it's deterministic or intermittent.
- Attach a screenshot or recording if visual.
- Specify the branch + environment + account/tenant.

## "Is it a product bug or a test bug?"

| Symptom | Likely |
|---|---|
| Same assertion fails 10/10 runs on clean machine | Product bug |
| Fails locally, passes in CI (or vice versa) | Test bug (timing, viewport, env) |
| Fails only after UI copy change | Test bug (brittle text selector) |
| Fails only on certain accounts/tenants | Either — report the symptom, let dev team triage |
| Fails after dependency bump | Could be either — bisect if possible |

**When genuinely unsure:** file the bug, mark the cause as "unknown — test or product." Better to over-report than under-report.

## Bug report hygiene

From [ui-bug-report.md](../../docs/ui-bug-report.md):

- **Include a "Verified Working Features" section.** Lists what passed. Without it, readers assume the whole feature is broken.
- **Reference test IDs.** Every bug links to the spec that catches it. When devs fix the bug, they re-run that spec.
- **Run environment block at the top:** date, browser, viewport, environment (localhost/staging/prod), account/tenant.
- **Summary table first.** Total / Passed / Failed / Skipped per suite — lets someone skim in 10 seconds.

## Porting to another repo

1. Copy the template structure from [docs/ui-bug-report.md](../../docs/ui-bug-report.md).
2. Keep a rolling document — `docs/ui-bug-report.md` in your repo, updated each test run.
3. Use BUG-NNN IDs globally (don't reset per run); lets you track recurrence.
4. Link test-case IDs (TTS_DAS_09 etc.) in every bug row — the pivot between bug and regression.

## Gotchas

- **Don't write "fix it by..." in a bug report.** That's a dev's job. If you have a hypothesis, put it in a **Note** field, not the title.
- **Don't merge bug reports across runs silently.** If BUG-001 keeps appearing across 5 runs, note it ("seen since Apr 6") rather than re-numbering.
- **Screenshots > descriptions for UI bugs.** Attach a screenshot cropped to the relevant area. Whole-page screenshots hide the bug.
- **Don't file duplicates.** Search the existing bug list before filing. If unsure, add it as a comment on the existing bug.
