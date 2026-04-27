---
name: sku-anchored-test-targeting
description: Make Playwright tests deterministic on lists that re-sort after every mutation. Replace "first row" selection with SKU-anchored search → open/select flows, backed by a centralised SKU config with loud-fail validation and an optional suite-end verification registry for async backend state. Use when tests act on a list view whose order changes after edits, uploads, or status transitions — or when the user reports "test passes alone but fails in a batch", "first row is wrong product", or ordering-dependent flakiness.
author: Yash Trivedi
---

# sku-anchored-test-targeting

## Problem

End-to-end tests that act on "the first row" of a mutable list look simple, but they fail in two predictable ways:

1. **The list reshuffles between tests.** Many product/inventory/activity grids sort by "recently edited" — so the first test edits row A, the second test runs and row A is now on top, and the second test accidentally edits row A again instead of the intended row B. Each run targets a different product depending on prior state.
2. **Destructive tests clobber each other.** If test T1 deactivates the first row, test T2 (which was meant to edit that product) now hits a deactivated product and either silently skips or fails for the wrong reason.

The usual "just run tests in a fixed order" response is a band-aid — it hides the real issue, breaks parallelism, and collapses the moment someone runs a single test in isolation.

## The approach

Every test that mutates or targets a specific product names its target by **SKU**, not by list position. The SKU lives in a central config file (not hardcoded in the test), is validated with a loud-fail helper, and is resolved at runtime via two POM methods that handle search + exact-match.

All helpers live in [tests/ui/pages/products/products-list.page.ts](../../tests/ui/pages/products/products-list.page.ts) and [tests/ui/config/test-sku-config.ts](../../tests/ui/config/test-sku-config.ts).

### 1. Centralised SKU config — one file, grouped by intent

```ts
// tests/ui/config/test-sku-config.ts
export const TEST_SKUS = {
  saveFlowLive: "44247548559525",        // non-destructive edit-and-restore
  deactivateModal: "44189600743589",     // modal open + cancel only
  deactivateSuccess: "44189600743589",   // destructive but reversible
  deleteModal: "123",                    // destructive, needs confirmation
  deleteSuccess: "123",                  // one-shot delete
  syncTarget: "44228571922597",          // async backend verification
  uploadTarget: "44228571922597",
  statusReferenceLive: "",
  statusReferenceInactive: "",
} as const;

export function requireSku(slotName: keyof typeof TEST_SKUS): string {
  const sku = TEST_SKUS[slotName];
  if (!sku || sku.trim() === "") {
    throw new Error(
      `[test-sku-config] The "${slotName}" SKU is empty. Fill it in at ` +
        `tests/ui/config/test-sku-config.ts before running this test.`
    );
  }
  return sku;
}
```

**Key ideas:**
- **Slots are grouped by test intent, not by test ID.** `saveFlowLive` is shared across 6 non-destructive tests; `deleteSuccess` is its own slot because it's one-shot. This keeps the config small as the suite grows.
- **Empty slot = loud failure, never a fallback.** `requireSku()` throws with a message telling you *exactly* which file to edit. Tests never silently fall back to "first row" — that's what caused the flakiness originally.
- **Single source of truth.** When a sandbox product is retired, changing one line in the config moves every dependent test onto the replacement.

### 2. `searchAndOpenBySku(sku)` — land on the edit page

```ts
async searchAndOpenBySku(sku: string): Promise<void> {
  await this.open();
  await this.searchProduct(sku);
  const matchingRow = this.findRowBySkuExact(sku);
  await matchingRow.waitFor({ state: "visible", timeout: 15_000 });
  const titleButton = matchingRow.getByRole("button").filter({ hasText: /\S{2,}/ }).first();
  await titleButton.click({ timeout: 10_000 });
  await this.page.waitForLoadState("domcontentloaded");
  await this.page
    .getByRole("heading", { name: /basic\s*information|product\s*details/i })
    .or(this.page.locator("main").getByText(/^(Title|Price|Description)$/).first())
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
}
```

**Key idea: the search box is not enough.** Product search often matches SKU *substrings* in titles, categories, or descriptions — so a search for `123` can return five rows. The `findRowBySkuExact` helper applies a second, row-level regex filter against the `SKU: <value>` text with a word-boundary lookahead (`(?!\d)`) so `123` doesn't match `12345`. This two-pass filter is what makes SKU targeting reliable.

### 3. `searchAndSelectBySku(sku, { tab })` — check the row checkbox for Bulk Action flows

```ts
async searchAndSelectBySku(
  sku: string,
  opts: { tab?: "All" | "Not Uploaded" | "Live" | "Inactive" | ... } = {}
): Promise<Locator> {
  await this.open();
  if (opts.tab) { /* switch tab first */ }
  await this.searchProduct(sku);
  const matchingRow = this.findRowBySkuExact(sku);
  await matchingRow.waitFor({ state: "visible", timeout: 15_000 });
  const checkbox = matchingRow.getByRole("checkbox").first();
  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkbox.click({ timeout: 10_000 });
  }
  return matchingRow;
}
```

**Key idea: Bulk Action flows don't navigate into edit.** They operate on the list view — tick the checkbox, then open the Bulk Action menu. Returning the row `Locator` lets the caller do follow-up work (click the row's ⋮ Actions menu, inspect its status column) without re-searching.

The `tab` option matters because "Delete Products" and "Deactivate" only appear on Live/Inactive tabs — the helper switches tab first, then searches, so the SKU is looked up in the right grid.

### 4. Suite-end verification registry — decouple trigger from verify

For async backend state (upload, sync, deactivate), the action completes later than the test. `test-sku-config.ts` exposes a small registry:

```ts
export function queueVerification(v: PendingVerification): void { ... }
export function drainPendingVerifications(): PendingVerification[] { ... }
```

Destructive tests push an entry after triggering their action:

```ts
queueVerification({
  sku: TEST_SKUS.deactivateSuccess,
  sourceTestId: "TTS_P_150",
  expectedStatusPattern: /Inactive/i,
  description: "deactivation succeeded",
});
```

A final `test("suite-end verification")` drains the queue, polls each SKU's status column, and asserts. This cleanly separates "did the button work" from "did the backend actually do it" — which lets the action-trigger test finish quickly while backend-state assertions run at the end with adequate settle time.

## Recipe: porting to a new test

1. **Pick a slot.** If your test matches an existing slot's intent (non-destructive edit? reuse `saveFlowLive`), reuse it. Otherwise add a new slot to `test-sku-config.ts` with a comment explaining what kind of product it needs (Live? Not Uploaded? With attributes?).
2. **At the top of the test:**
   ```ts
   const sku = requireSku("saveFlowLive");
   r.log(`Target SKU: ${sku}`); // first log entry — surfaces in validation reports
   ```
3. **Replace list-based navigation with SKU lookup:**
   - Edit flow → `await productsPage.searchAndOpenBySku(sku);`
   - Bulk Action flow → `const row = await productsPage.searchAndSelectBySku(sku, { tab: "Live" });`
4. **For async actions:** after triggering, `queueVerification({ ... })`. The suite-end test handles the assertion.
5. **Never fall back to "first row"** on failure. If the SKU isn't found, the test must fail — falling back masks the real problem.

## Recipe: picking the right SKU for a new slot

- **Non-destructive edit tests** — pick one Live product with a rich schema (Attributes mapping, variations, images). One SKU serves many tests.
- **Destructive/reversible tests** — dedicated SKU per category (deactivate, reactivate). OK to share across reversible tests if they run sequentially.
- **One-shot destructive tests (delete success)** — dedicated *throwaway* SKU. After the test runs, the product is gone; you'll need to recreate or point to a fresh one.
- **Async async action tests (sync, upload)** — use the same SKU as the paired verification test, because `queueVerification` keys by SKU.

## Gotchas

- **SKU substring collisions.** The app's search box matches substrings; a SKU `123` can return many rows. Always use the `findRowBySkuExact` regex filter (word-boundary lookahead). The `searchAndOpenBySku` helper already does this — don't bypass it.
- **Tab context matters.** If you search for an Inactive SKU while on the Live tab, you get zero results. Always pass `{ tab }` to `searchAndSelectBySku` when the product may not be on the current tab.
- **Don't skip `requireSku()`.** Direct `TEST_SKUS.slotName` reads bypass the loud-fail check — when someone forgets to fill in the slot, the test will pass search with an empty query and act on the first row again. That is the exact bug this pattern exists to prevent.
- **`r.log` the SKU first.** Makes the target visible in validation reports. When a test fails, you immediately know *which product* it tried to act on — critical when the failure is "product state was unexpected" vs "selector didn't match".
- **Destructive tests should not share SKUs.** Two tests each deleting `deleteSuccess` will fail on the second run because the product is gone. Suite-end verification reads status, so it needs the SKU to still exist at drain time.
- **Config order is stable.** Since slot names are the API, renaming a slot is a breaking change for every test that uses it. Add new slots, don't rename old ones.

## Porting to another repo

1. Copy [test-sku-config.ts](../../tests/ui/config/test-sku-config.ts) — rename the slot names to match your domain (product/order/customer/etc).
2. Copy the `searchAndOpenBySku` / `searchAndSelectBySku` / `findRowBySkuExact` methods into your list-page POM. Replace the "SKU: <value>" regex with whatever stable identifier your rows render (order number, customer ID, etc.).
3. If your search box matches exact IDs (no substring collision), you can skip the row-level regex filter — but verify first; most apps do substring matching.
4. For Bulk Action flows, adjust the tab enum to match your app's tabs.
5. Migrate tests one slot at a time. Start with the most-flaky destructive tests — the payoff is largest there.

## Why this pattern, vs. the alternatives

| Alternative | Why it fails |
|---|---|
| "Run tests in a fixed order" | Breaks parallelism; breaks running a single test in isolation; hides the real root cause. |
| "Create a fresh product at the start of every test" | Slow; pollutes the data; still has to pick *which* product when verifying list-level behavior. |
| "Seed the DB and reset between tests" | Often not available against a staging backend shared with other teams; API auth rules may forbid bulk deletes. |
| **SKU-anchored targeting** | Works against any environment, supports parallel runs, keeps tests readable, and when a test fails the SKU in the report tells you exactly which product was involved. |
