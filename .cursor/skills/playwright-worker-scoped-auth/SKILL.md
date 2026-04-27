---
name: playwright-worker-scoped-auth
description: Log in once per Playwright worker instead of once per test. Uses a worker-scoped fixture to share an authenticated BrowserContext across every test in that worker — massive wall-clock savings on suites where login is slow (10-30s per test × 100 tests = 15-50 min wasted). Use when tests rely on a logged-in session, when test runs feel disproportionately slow vs number of tests, or when the user mentions auth fixture, storageState, login once, or slow test suite.
author: Yash Trivedi
---

# playwright-worker-scoped-auth

## Problem

Default Playwright fixtures are **test-scoped**: each test gets a fresh browser context. If your app needs login, you run the login flow 100× for 100 tests. That's 100 × ~15s = **25 minutes of pure login overhead**.

`storageState` JSON files help, but they're stale snapshots — for JWT-based apps with short-lived tokens, you end up refreshing them constantly or hitting session-expired errors mid-run.

## The pattern

Use a **worker-scoped fixture** (`{ scope: "worker" }`) that:

1. Creates one `BrowserContext` per worker.
2. Logs in once (real auth flow — no stale storageState).
3. Exposes the authenticated `Page` to every test in that worker.

Playwright runs parallel workers — if you set `workers: 1` you get one login total for the whole suite. If `workers: 4`, you get four logins (one per worker) and the workers run in parallel. Either way, it's **N logins, not N-tests logins**.

## The fixture

See [tests/ui/fixtures/auth.fixture.ts](../../tests/ui/fixtures/auth.fixture.ts). Core shape:

```ts
import { test as base, type Page, type BrowserContext } from "@playwright/test";
import { openAuthenticatedDashboard } from "../helpers/dashboard-auth.js";
import { reduceClickInterference } from "../helpers/reliable-action.js";

type PomFixtures = {
  authenticatedPage: Page;
  dashboardPage: DashboardPage;
  // ... other POMs
};

type PomWorkerFixtures = {
  sharedAuthContext: BrowserContext;
  sharedAuthPage: Page;
};

export const test = base.extend<PomFixtures, PomWorkerFixtures>({
  // Worker-scoped: ONE login per worker (workers=1 → one login total)
  sharedAuthContext: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      await openAuthenticatedDashboard(page);         // ← real login flow, runs once
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await reduceClickInterference(page);
      await use(context);
      await context.close();
    },
    { scope: "worker" },                              // ← the magic
  ],

  sharedAuthPage: [
    async ({ sharedAuthContext }, use) => {
      const page = sharedAuthContext.pages()[0] ?? await sharedAuthContext.newPage();
      await use(page);
    },
    { scope: "worker" },
  ],

  // Test-scoped: every test gets a reference to the shared page
  authenticatedPage: async ({ sharedAuthPage }, use) => {
    await use(sharedAuthPage);
  },

  // POMs — instantiate per-test against the shared page
  dashboardPage: async ({ authenticatedPage }, use) => {
    await use(new DashboardPage(authenticatedPage));
  },
});
```

Tests then import from this fixture file instead of `@playwright/test` directly:

```ts
import { test, expect } from "../fixtures/auth.fixture.js";
//                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

test("some test", async ({ dashboardPage }) => {
  await dashboardPage.open();
  // ... already logged in
});
```

## The critical trade-off

**Pro:** massive speedup — login runs N times (= number of workers), not per test.

**Con:** tests **share state**. A test that mutates the app (creates a product, changes a setting) affects subsequent tests in the same worker. Two ways to deal with this:

1. **Run in serial mode with `workers: 1`.** Slowest concurrency but simplest. Useful for small suites. Used in this repo — see `test.describe.configure({ mode: "serial" })` in POM specs.
2. **Clean up in `afterEach`.** More work, but lets you keep parallel workers.

For QA smoke/regression suites that mostly *read* state (dashboard counts, product lists), serial + single-worker is usually fine and still **5-10× faster** than per-test login.

## Configuring workers

In [playwright.config.ts](../../playwright.config.ts):

```ts
export default defineConfig({
  workers: process.env.CI ? 1 : 1,  // Or 2-4 locally if tests are independent
  // ...
});
```

## Porting to another repo

1. Create `tests/fixtures/auth.fixture.ts` with the shape above.
2. Replace the login call with your app's real flow (storageState path, API login, SSO, whatever).
3. In specs, import `test` from the fixture file — not `@playwright/test`.
4. Add POMs as test-scoped fixtures that depend on `authenticatedPage`.
5. Run: login latency drops from `N × login_time` to `workers × login_time`.

## Gotchas

- **Worker-scoped fixtures cannot depend on test-scoped fixtures.** Playwright throws if you try. Structure: worker fixtures (auth context, auth page) → test fixtures (POMs, per-test state).
- **`storageState: { cookies: [], origins: [] }`** starts each worker with a clean context. Don't skip this — otherwise workers share cookies, which causes subtle race conditions.
- **Page crashes inside the worker kill the shared page.** Subsequent tests in that worker fail with "Target page, context or browser has been closed." Mitigation: add a health check at start of each test that re-navigates if needed.
- **Session expiry mid-run.** If your JWT expires after 1 hour and the suite runs 2 hours, the shared context goes stale. Options: shorter worker lifetimes, token refresh in a periodic fixture, or split the suite.
- **Trace files bloat fast.** Worker-scoped contexts generate long traces. Use `trace: "retain-on-failure"` rather than `trace: "on"`.
