/**
 * TEST SKU CONFIGURATION (per-app)
 *
 * Every destructive or state-specific test in this suite targets a product by
 * SKU (never "first row") because most seller/ecomm list views re-sort after
 * each edit — "first row" is a different product every run.
 *
 * HOW TO FILL THIS IN:
 *  1. Open your app's product list.
 *  2. For each slot below, copy a product's SKU (or your app's equivalent
 *     primary id — see `entityNames.productId` in your profile).
 *  3. For destructive tests, prefer DEDICATED SANDBOX products so tests
 *     don't interfere with each other.
 *
 * Empty slots fail LOUDLY when a test asks for them (see `requireSku`).
 * This is intentional — we never fall back to "first row", which was the
 * exact flakiness source this system exists to prevent.
 *
 * (The sku-anchored-test-targeting skill has the full rationale.)
 */

export const TEST_SKUS = {
  // Non-destructive save-flow tests. Must be a Live product with a rich schema
  // (attributes mapping, variations, images) so it exercises multiple tests.
  saveFlowLive: "",

  // Deactivate modal tests — modal is cancelled, no actual deactivation.
  deactivateModal: "",

  // Deactivate SUCCESS — destructive but reversible. Live product only.
  deactivateSuccess: "",

  // Delete modal cancel — Live or Inactive product.
  deleteModal: "",

  // Delete SUCCESS — destructive. Not Uploaded product you're OK losing.
  deleteSuccess: "",

  // Sync tests (inventory / price) — Live product. Verified at suite end.
  syncTarget: "",

  // Upload test — Not Uploaded product.
  uploadTarget: "",

  // Read-only reference tests.
  statusReferenceLive: "",
  statusReferenceInactive: "",
} as const;

/** Loud-fail on empty slot. */
export function requireSku(slotName: keyof typeof TEST_SKUS): string {
  const sku: string = TEST_SKUS[slotName];
  if (!sku.trim()) {
    throw new Error(
      `[test-sku-config] The "${slotName}" SKU is empty. Fill it in at ` +
        `tests/ui/config/test-sku-config.ts before running this test.`
    );
  }
  return sku;
}

/** Queue of async-state verifications to drain at suite end. */
export type PendingVerification = {
  sku: string;
  sourceTestId: string;
  expectedStatusPattern: RegExp;
  description: string;
};

const pendingVerifications: PendingVerification[] = [];

export function queueVerification(v: PendingVerification): void {
  pendingVerifications.push(v);
}

export function drainPendingVerifications(): PendingVerification[] {
  const copy = pendingVerifications.slice();
  pendingVerifications.length = 0;
  return copy;
}
