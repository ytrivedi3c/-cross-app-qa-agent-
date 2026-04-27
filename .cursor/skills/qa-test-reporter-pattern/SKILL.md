---
name: qa-test-reporter-pattern
description: Attach structured step-by-step PASS/FAIL validation reports to Playwright HTML reports using a lightweight TestReporter helper. Use when a Playwright test needs to show per-step expected/actual/status rows in the HTML report (auditable by non-devs) instead of a flat pass/fail, or when the user mentions TestReporter, validation report, test case ID, or per-step assertions.
author: Yash Trivedi
---

# qa-test-reporter-pattern

## Problem

Playwright's default HTML report tells you a test passed or failed — it doesn't tell a QA lead, PM, or auditor *which specific expectations were checked* and *what the actual value was*. When one test verifies 6 order-status chips, you want all 6 rows visible in the report, not a single green checkmark.

## The pattern

A small `TestReporter` class collects validation rows during a test and attaches a markdown table to `test.info()`. The table is visible in the Playwright HTML report for every test — passing or failing.

```ts
const r = new TestReporter("TTS_DAS_09", "Order status counts are numeric", "Every status has a numeric count");

for (const status of ["Awaiting Shipment", "Completed", "Cancelled", "Failed"]) {
  const match = orderText.match(new RegExp(status + "\\s+(\\d+)"));
  if (match) {
    r.log(`Order "${status}" count`, "numeric >= 0", match[1], "PASS");
  } else {
    r.log(`Order "${status}" count`, "numeric >= 0", "not found", "FAIL");
  }
}

await r.attach();
```

Resulting HTML report:

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Order "Awaiting Shipment" count | numeric >= 0 | 7 | ✅ PASS |
| 2 | Order "Completed" count | numeric >= 0 | 14 | ✅ PASS |
| … | … | … | … | … |

## Why this beats the default report

1. **Per-test-case traceability.** The test ID appears in every attached report — matches a requirements registry one-to-one.
2. **Visible on PASS, not just FAIL.** Default Playwright attaches logs only on failure; this attaches every run, so you can audit what was actually validated even when green.
3. **Readable by non-engineers.** Markdown tables render in the HTML report viewer. QA leads and PMs don't need to read test code.
4. **No custom reporter needed.** Uses Playwright's built-in `test.info().attach()` API — no `playwright.config.ts` changes.

## The helper

See [test-reporter.ts](../../tests/ui/helpers/test-reporter.ts). Methods:

| Method | Use when |
|--------|----------|
| `log(step, expected, actual, status)` | Full control, any of PASS/FAIL/SKIP/WARN |
| `pass(step, expected, actual)` | Shorthand for known-pass |
| `fail(step, expected, actual)` | Shorthand for known-fail |
| `skip(step, reason)` | Feature not present in this environment |
| `warn(step, expected, actual)` | Soft failure — test still passes overall |
| `check(step, expected, boolean)` | Resolves PASS/FAIL from a boolean |
| `attach()` | Call once at end of test |

## Rules

1. **One reporter per test.** Instantiate at top, `await r.attach()` at bottom.
2. **Log *before* throwing assertions.** `expect(...)` throws on failure; anything after doesn't log. Put `r.log(...)` first, then `expect(...)`.
3. **Never hardcode `"PASS"` on a conditional step.** Use `check()` or compute status from the boolean. Hardcoded `"PASS"` is the #1 cause of silent-pass bugs.
4. **Test-case ID must match your registry.** It's the only way auditors map a report row back to a requirement.

## Worked example

Real test from [dashboard-full.pom.spec.ts](../../tests/ui/pom-specs/dashboard-full.pom.spec.ts) (`TTS_DAS_09`):

```ts
test("TTS_DAS_09: order status counts are numeric", async ({ authenticatedPage }) => {
  const r = new TestReporter("TTS_DAS_09", "Every order status has correct count", "Should show correct count");

  const main = authenticatedPage.locator("main");
  const mainText = await main.innerText({ timeout: 10_000 }).catch(() => "");
  const orderSectionMatch = mainText.match(/Order Status[\s\S]*?(?=Frequently Asked|Recent Activit|Pricing Info|$)/);
  const orderText = orderSectionMatch ? orderSectionMatch[0] : mainText;

  const statuses = ["Awaiting Shipment", "Awaiting Collection", "Completed", "Cancelled", "Failed", "Delivered"];
  let countsFound = 0;
  for (const status of statuses) {
    const match = orderText.match(new RegExp(status + "[\\s\\n]+(\\d+)", "i"));
    if (match) {
      r.log(`Order "${status}" count`, "numeric >= 0", match[1], "PASS");
      countsFound++;
    } else {
      r.log(`Order "${status}" count`, "numeric >= 0", "not found on dashboard", "FAIL");
    }
  }
  expect(countsFound).toBe(statuses.length);
  await r.attach();
});
```

## Porting to another repo

1. Copy [tests/ui/helpers/test-reporter.ts](../../tests/ui/helpers/test-reporter.ts) to your project's helpers folder.
2. Decide on a test-case ID scheme (`<MODULE>_<NUMBER>`).
3. Wrap existing Playwright tests — add `new TestReporter(...)` at top and `await r.attach()` at bottom.
4. Open the report: `npx playwright show-report`. Each test now has a "Validation Report" attachment with the per-step table.

## Gotchas

- **Content type must be `text/markdown`** for the table to render. The helper sets this; don't override.
- **Don't call `r.log()` inside `page.evaluate(...)` callbacks.** Those run in the browser, not Node. Return the value, then log on the Node side.
- **Serial vs parallel.** Each test instance owns its reporter — no collision in parallel mode.
