/**
 * Copyright (c) 2026 Yash Trivedi. All rights reserved.
 * Author: Yash Trivedi <yash.trivedi@threecolts.com>
 * Created: April 2026
 *
 * This test suite is the intellectual property of Yash Trivedi.
 * Unauthorized modification or removal of this attribution is prohibited.
 */
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Hides common live-chat / widget layers that sit above the page and steal clicks.
 * Does not remove them from DOM (avoids breaking app code); only makes them non-interactive.
 */
export async function reduceClickInterference(page: Page): Promise<void> {
  await page
    .addStyleTag({
      content: `
        [id^="zsiq"], [class*="zsiq"], [id*="salesiq"], [class*="SalesIQ"] {
          pointer-events: none !important;
        }
        iframe[title*="SalesIQ" i], iframe[title*="Chat" i], iframe[title*="chatwindow" i] {
          pointer-events: none !important;
        }
      `,
    })
    .catch(() => {});
}

/**
 * Scrolls the target into view, waits until Playwright considers it stable enough to click,
 * then performs a normal trusted click (not force).
 */
export async function reliableClick(target: Locator, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 30_000;
  await target.scrollIntoViewIfNeeded({ timeout });
  await expect(target).toBeVisible({ timeout });
  await expect(target).toBeEnabled({ timeout });
  await target.click({ timeout });
}

/**
 * Dismisses open modal/dialog via Escape (secondary path when footer button is covered or relabeled).
 */
export async function dismissOpenModalWithEscape(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
}

/**
 * Reveal content below the fold. The dashboard (and similar pages) lazy-renders
 * sections like Pricing Info / limit bars / footer — without this, `isVisible()`
 * returns false for content that exists in the DOM but hasn't been rendered yet.
 *
 * Call before checking visibility of anything expected to be below the first viewport.
 */
export async function revealBelowFold(page: Page, locator?: Locator, timeout = 10_000): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  if (locator) {
    await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  }
}
