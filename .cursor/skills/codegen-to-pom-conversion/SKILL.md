---
name: codegen-to-pom-conversion
description: Convert raw Playwright codegen recordings into maintainable Page Object Model (POM) specs without losing the selector accuracy codegen gives you. Covers when to record vs when to refactor, how to extract selectors into page objects, and the brittleness rules for text-based vs role-based vs nth-child selectors. Use when handed codegen recordings, when tests break after a minor UI change, or when the user mentions codegen, page object, selector stability, or recorded flow.
author: Yash Trivedi
---

# codegen-to-pom-conversion

## Problem

Two broken workflows teams fall into:

1. **Codegen-only.** Record every flow with `npx playwright codegen`, paste output into a spec, commit. Selectors are a mix of `nth-child`, `getByText`, CSS classes. One button relabel → 15 tests break → you re-record. No structure, no reuse.
2. **POM-only from scratch.** Writers imagine selectors without running the app. They pick fragile CSS or overly strict locators. Tests pass once, flake on the next deploy.

The right workflow uses **codegen as the selector source of truth** and **POM as the code structure**.

## The workflow

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ 1. Record flow   │ → │ 2. Extract       │ → │ 3. Test uses POM │
│    with codegen  │   │    selectors     │   │    method, not   │
│    on target     │   │    into Page     │   │    raw selector  │
│    branch        │   │    Object        │   │                  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

**Step 1 — record:**
```bash
npx playwright codegen http://localhost:3000/login
```
Walk through the happy path. Codegen writes to a temp `.spec.ts`. Don't commit this yet — it's raw material.

**Step 2 — extract:** identify each user action. For each one, add a method to the relevant Page Object:

```ts
// tests/ui/pages/dashboard.page.ts
export class DashboardPage {
  constructor(private readonly page: Page) {}

  // One codegen line: `await page.getByRole('button', { name: 'Refresh' }).click();`
  // becomes this method:
  async clickRefresh(): Promise<void> {
    await reliableClick(this.page.getByRole("button", { name: "Refresh" }));
  }
}
```

**Step 3 — spec uses the method:**
```ts
test("dashboard refresh works", async ({ dashboardPage }) => {
  await dashboardPage.open();
  await dashboardPage.clickRefresh();
  // assertion...
});
```

When the button is later relabeled to "Reload", you update **one line** in the POM. Every spec that calls `clickRefresh()` keeps working.

## Selector priority (use codegen's output as a starting point, not gospel)

Codegen picks the first selector that matches. That's not always the most stable. Rank them:

| Priority | Example | Why |
|---|---|---|
| 1. `getByTestId` | `page.getByTestId("dashboard-refresh")` | Survives copy changes, CSS refactors, i18n |
| 2. `getByRole` + name | `page.getByRole("button", { name: "Refresh" })` | Stable, accessibility-aligned |
| 3. `getByLabel` (forms) | `page.getByLabel("Email")` | Stable for inputs |
| 4. `getByText` | `page.getByText("Refresh")` | Breaks on i18n, copy changes |
| 5. CSS with `id` | `page.locator("#dashboard-header-refresh")` | Fine if IDs are stable |
| 6. `nth-child` / long CSS chains | `page.locator("div:nth-child(3) > button")` | **Almost always brittle** — refactor |

**When codegen gives you level 6, rewrite it to level 1-3.** Codegen doesn't know which selectors the dev team considers stable; only you do.

## Branch discipline

Per this project's setup, **ALL product flows are recorded on the develop branch** (the active dev branch, where selectors are current). Record on the same branch the test will run against — cross-branch drift is a common failure source.

If the app has a public/embedded fork (as this repo does), record each fork separately. Don't assume selectors port.

## When codegen is worth re-running

- **After a major UI refactor.** Re-record, diff the new selectors against your POM, update methods.
- **For a new flow you've never automated.** Never invent selectors from memory — record.
- **When a test starts flaking.** Re-record the same flow; compare selectors. If codegen picks something different now, the UI changed.

## When NOT to use codegen

- **For assertions.** Codegen's `expect(...)` assertions are usually too loose. Write assertions by hand.
- **For error paths and edge cases.** Codegen records happy paths. Empty states, error toasts, permission-denied flows — you write those manually.
- **For data-driven tests.** Codegen captures one input. For parametric tests, write the loop yourself.

## POM directory convention (from this repo)

```
tests/ui/
├── pages/
│   ├── dashboard.page.ts
│   ├── products/
│   │   ├── products-list.page.ts
│   │   └── product-edit.page.ts
│   ├── orders/
│   │   ├── orders-list.page.ts
│   │   └── order-view.page.ts
│   └── ...
├── pom-specs/
│   ├── dashboard-full.pom.spec.ts
│   ├── products-e2e.pom.spec.ts
│   └── ...
├── fixtures/
│   └── auth.fixture.ts      ← exposes POMs as fixtures
└── helpers/
    ├── reliable-action.ts
    ├── test-reporter.ts
    └── dashboard-locators.ts
```

Specs in `pom-specs/` never touch `page.locator(...)` directly — everything goes through a POM method.

## Gotchas

- **Codegen output is a starting point, not a spec.** Never commit raw codegen without converting to POM.
- **Don't mix paradigms.** A file that's half POM calls, half raw locators is the worst of both worlds. Pick one per spec.
- **Keep POMs stateless where possible.** A POM method that returns data (like `getProductCounts(): Promise<Record<string, number>>`) is easier to test than one that sets instance variables.
- **One POM per page/view, not per test.** If two tests need the dashboard, they share `DashboardPage`. Resist the urge to make per-test subclasses.
