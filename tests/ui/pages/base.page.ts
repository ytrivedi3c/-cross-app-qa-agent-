import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  reduceClickInterference,
  reliableClick,
  revealBelowFold,
} from "../helpers/reliable-action.js";
import { getActiveProfile, type AppProfile } from "../config/app-profile.js";

/**
 * Base POM — every feature page extends this.
 *
 * The KEY DIFFERENCE from the original QA-automation BasePage is that all
 * app-specific shape (URL structure, panel path pattern) is now read from
 * the active AppProfile instead of hardcoded. Subclasses define only:
 *   - `routeKey`: which profile.routes entry they use
 *   - `readyLocator`: the locator that signals "page is loaded"
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly mainContent: Locator;
  protected readonly profile: AppProfile;

  /** Subclasses declare which profile.routes entry identifies this page. */
  abstract readonly routeKey: keyof AppProfile["routes"];

  /** Subclasses define a locator that signals the page has fully loaded. */
  abstract readonly readyLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator("main");
    this.profile = getActiveProfile();
  }

  /** Route suffix for this page, resolved from the active profile. */
  protected get pathSuffix(): string {
    return this.profile.routes[this.routeKey];
  }

  /**
   * Panel base path extracted from the current URL using the profile's
   * panelPathPattern. Some apps have per-user panels; others don't. The
   * pattern handles both — if it doesn't match, we fall back to the origin.
   */
  protected get panelBase(): string {
    const url = this.page.url();
    const match = url.match(this.profile.auth.panelPathPattern);
    if (match) return match[1];
    // Fallback: just the origin. Works for apps without per-user panel paths.
    const origin = url.match(/^https?:\/\/[^/]+/);
    if (origin) return origin[0];
    throw new Error(`[base.page] Could not extract panel base from ${url}`);
  }

  async navigate(): Promise<void> {
    const target = `${this.panelBase}${this.pathSuffix}`;
    await this.page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  async waitForReady(timeout = 60_000): Promise<void> {
    await expect(this.readyLocator).toBeVisible({ timeout });
  }

  async open(): Promise<void> {
    await this.navigate();
    await this.waitForReady();
    await this.suppressOverlays();
  }

  async suppressOverlays(): Promise<void> {
    await reduceClickInterference(this.page);
  }

  async revealBelowFold(locator?: Locator): Promise<void> {
    await revealBelowFold(this.page, locator);
  }

  async clickReliably(locator: Locator, timeout?: number): Promise<void> {
    await reliableClick(locator, { timeout });
  }

  mainGetByRole(
    role: Parameters<Page["getByRole"]>[0],
    options?: Parameters<Page["getByRole"]>[1]
  ): Locator {
    return this.mainContent.getByRole(role, options);
  }

  mainGetByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainContent.getByText(text, options);
  }

  async expectUrl(pattern?: RegExp): Promise<void> {
    const p =
      pattern ??
      new RegExp(this.pathSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    await expect(this.page).toHaveURL(p, { timeout: 15_000 });
  }

  async expectTitle(pattern: RegExp): Promise<void> {
    await expect
      .poll(() => this.page.title(), {
        timeout: 30_000,
        intervals: [300, 800, 1500],
      })
      .toMatch(pattern);
  }

  async dismissModal(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  async isPresent(locator: Locator): Promise<boolean> {
    return (await locator.count()) > 0;
  }

  async waitForNetworkIdle(timeout = 15_000): Promise<void> {
    await this.page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  }
}
