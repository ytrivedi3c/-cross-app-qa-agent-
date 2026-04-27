---
name: playwright-reliable-interactions
description: Fix the three most common Playwright flakiness sources — chat widgets stealing clicks, below-the-fold lazy renders reporting invisible, and modal buttons covered by overlays. Three small helpers (reduceClickInterference, reliableClick, revealBelowFold) applied consistently remove >90% of "button not clicking" and "locator not found" flakes. Use when tests fail intermittently on click/visibility assertions, or when the user mentions flaky clicks, chat overlay, SalesIQ, Intercom, lazy-rendered content, or scrolling issues.
author: Yash Trivedi
---

# playwright-reliable-interactions

## Problem

Most "flaky Playwright test" tickets trace back to three classes of issue:

1. **Chat widgets / marketing pop-ups steal clicks.** Zoho SalesIQ, Intercom, Drift — they inject fixed-position iframes that intercept pointer events. Your `button.click()` technically lands on the chat widget, not the button.
2. **Below-the-fold content isn't rendered yet.** React/Vue apps lazy-render offscreen sections. `locator.isVisible()` returns false for DOM elements that exist but haven't hit the viewport.
3. **Force-clicking hides real bugs.** `locator.click({ force: true })` masks the overlay/disabled/covered issue; the test passes but the user-facing flow is still broken.

## The three helpers

All live in [tests/ui/helpers/reliable-action.ts](../../tests/ui/helpers/reliable-action.ts).

### 1. `reduceClickInterference(page)` — neutralize chat widgets

```ts
export async function reduceClickInterference(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      [id^="zsiq"], [class*="zsiq"], [id*="salesiq"], [class*="SalesIQ"] {
        pointer-events: none !important;
      }
      iframe[title*="SalesIQ" i], iframe[title*="Chat" i], iframe[title*="chatwindow" i] {
        pointer-events: none !important;
      }
    `,
  }).catch(() => {});
}
```

**Key idea:** `pointer-events: none` disables clicks **without removing elements from DOM**. The app under test still runs its chat-widget code (no null refs); it just can't steal clicks. Removing the DOM nodes would break the app.

Extend the selector list when you port this: match whatever chat widget your app uses.

### 2. `reliableClick(target, opts?)` — click with pre-flight checks

```ts
export async function reliableClick(target: Locator, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 30_000;
  await target.scrollIntoViewIfNeeded({ timeout });
  await expect(target).toBeVisible({ timeout });
  await expect(target).toBeEnabled({ timeout });
  await target.click({ timeout });
}
```

**Key idea:** scroll → visible → enabled → click, all with a single shared timeout. This is a **trusted click** (not `force: true`) — if the button is actually blocked or disabled, the test correctly fails instead of silently passing.

### 3. `revealBelowFold(page, locator?, timeout?)` — force lazy renders

```ts
export async function revealBelowFold(page: Page, locator?: Locator, timeout = 10_000): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  if (locator) {
    await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  }
}
```

**Key idea:** one `window.scrollTo(0, bottom)` causes any `IntersectionObserver`-based lazy component to mount. Call this **before** asserting visibility of anything expected below the first viewport — pricing cards, limit bars, footer links.

## Recipe: before calling `.click()`

1. At test/fixture setup: `await reduceClickInterference(page);` (once per page)
2. If the element is below the fold: `await revealBelowFold(page, target);`
3. Click: `await reliableClick(target);`

## Modal dismissal

`dismissOpenModalWithEscape(page)` is also in the same file — use it as a fallback when the dialog's own Cancel button is covered or relabeled. Prefer dialog-scoped Cancel first, Escape second.

## Porting to another repo

1. Copy [reliable-action.ts](../../tests/ui/helpers/reliable-action.ts).
2. In `reduceClickInterference`, replace the chat-widget CSS selectors with whatever your app uses (Intercom = `iframe[name="intercom-*"]`, Drift = `iframe[id*="drift-"]`, etc.).
3. In the worker-scoped auth fixture (or per-test `beforeEach`), call `reduceClickInterference(page)` once after login.
4. Swap `page.click(selector)` → `reliableClick(page.locator(selector))` across the suite.
5. Before any `expect(belowFoldLocator).toBeVisible()`: prepend `await revealBelowFold(page, belowFoldLocator);`.

## Why `force: true` is banned here

Playwright's `click({ force: true })` bypasses all actionability checks. It makes tests pass when the user-facing button is genuinely covered or disabled. That's a **false green** — the worst kind of test failure. The three helpers above solve the underlying issues instead of masking them.

## Gotchas

- **`addStyleTag` is per-page.** If your suite creates multiple pages (e.g. popups), call `reduceClickInterference` on each one.
- **`scrollIntoViewIfNeeded` before `toBeVisible`.** `toBeVisible()` considers viewport — scrolling is required for offscreen elements. The helper does this in the correct order.
- **Lazy-render timing.** After `revealBelowFold`, give the `IntersectionObserver` a tick to fire — `await page.waitForTimeout(100)` is sometimes needed. Better: wait for a specific locator rather than a timeout.
- **Don't neutralize widgets you're testing.** If your test validates the chat widget itself, skip `reduceClickInterference` for that spec.
