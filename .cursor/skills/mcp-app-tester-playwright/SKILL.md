---
name: mcp-app-tester-playwright
description: Playwright UI automation for the TikTok Shop seller app at localhost with JWT login, dashboard locators, reliable clicks, and metrics scraping. Use when working on tests/ui, Playwright config, dashboard flows, seller tokens, or when the user mentions mcp-app-tester, dashboard tests, Refresh button, Product Status, or automation-workspace/company-app/frontend.
---

# mcp-app-tester — Playwright & dashboard UI

## What this repo does

- **Root app:** `mcp-app-tester` — Playwright drives the **webpack seller UI** in `automation-workspace/company-app/frontend` (default `http://localhost:3000`).
- **Login:** Always use **`/auth/login?user_token=<JWT>`**, not raw `/panel/<id>/dashboard` (avoids Session Expired).
- **Panel user id:** Must match JWT `user_id` — derive from token via `src/seller-token.ts` / `getPanelUserIdFromEnvJwt()`; do not rely on a mismatched `PANEL_USER_ID` in `.env`.

## Environment

- **`SELLER_ACCESS_TOKEN` or `USER_TOKEN`:** JWT for `user_token` query param.
- **`FORCE_UI_LOCALHOST=1`:** Set by npm scripts so UI targets localhost (see `src/app-urls.ts`).
- **`PW_SKIP_WEB_SERVER=1`:** Skip Playwright `webServer`; run `npm run dev` in the frontend yourself.

## Commands (repo root)

| Script | Purpose |
|--------|---------|
| `npm run test:ui` | All specs in `tests/ui/` |
| `npm run test:dashboard` | Wrapper → `dashboard-ui.spec.ts` |
| `npm run test:dashboard:refresh` | `dashboard-refresh.spec.ts` |
| `npm run test:dashboard:codegen-flow` | Metrics + refresh + sync modal smoke |
| `npm run test:automation` | `automation-workspace/automation-tests` (separate config) |
| `npm run test:ui:auth` | Save storage state (`scripts/save-auth-state.ts`) |

## Critical UI facts (avoid flaky tests)

1. **Dashboard card title is “Product Status”, not “Total Products”.** `TOTAL_PRODUCTS` in i18n is used elsewhere (e.g. profile). Wait for **`dashboardMainReady()`** / “Product Status” + “Order Status”.
2. **Refresh button:** `id="dashboard-header-refresh"` on `DashboardHeader.tsx`; **`dashboardHeaderRefresh(page)`** scopes to `<main>`.
3. **Sync TikTok:** Scope to Product Status card — **`syncTiktokShopButton(page)`**; viewport **≥ ~992px** so the button keeps a text label (not icon-only).
4. **Timeouts:** `openAuthenticatedDashboard` can exceed old 180s caps — use **`test.setTimeout(360_000)`** on heavy specs; `playwright.config.ts` sets viewport **1920×1080** and **actionTimeout**.

## Helpers (always reuse)

| File | Role |
|------|------|
| `tests/ui/helpers/dashboard-auth.ts` | `openAuthenticatedDashboard`, `ensureOnDashboard` |
| `tests/ui/helpers/dashboard-locators.ts` | `dashboardCopy`, `dashboardHeaderRefresh`, `syncTiktokShopButton`, `dashboardMainReady` |
| `tests/ui/helpers/reliable-action.ts` | `reliableClick`, `reduceClickInterference` (chat overlays), `dismissOpenModalWithEscape` |
| `tests/ui/helpers/dashboard-metrics.ts` | `scrapeDashboardMetrics` — product/order counts, plan “N out of M” lines |

## Playwright config

- **`playwright.config.ts`:** `testDir: ./tests/ui`, `webServer` runs webpack in `company-app/frontend` unless `PW_SKIP_WEB_SERVER=1`, `baseURL` from `getAppBaseUrl()`.

## Registry

- **`tests/dashboard-test-cases.md`:** TC_TT_001–033 registry (manual vs API noted).
- **`tests/ui/dashboard-ui.spec.ts`:** Serial suite, many TC_TT_* visibility tests.
- **`tests/ui/my-flow.spec.ts`:** User’s custom / codegen flows — prefer JWT + helpers over hardcoded panel URLs.

## When editing tests

- Prefer **`getByRole` / `getByTestId`** over `nth()` and long CSS chains.
- Before “button not clicking”: **`reduceClickInterference`**, **`scrollIntoViewIfNeeded`**, **`expect(locator).toBeEnabled()`**, then **`reliableClick`**.
- Modal dismiss: dialog-scoped **Cancel**, then **Escape** fallback.

## Optional deep reference

- See [reference.md](reference.md) for file map and troubleshooting.
