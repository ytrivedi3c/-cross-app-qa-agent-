import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";
import type { AppProfile } from "../../config/app-profile.js";

/**
 * Products list POM — generalized from the TikTok Shop original. All
 * hardcoded strings now read from the active profile:
 *   /listing/products              → profile.routes.products
 *   /active/i, /upload/i, ...       → profile.labels.*
 *   "table, [class*='DataTable']"  → profile.selectorHints.dataGrid
 *   SKU regex                       → profile.selectorHints.skuRowPattern
 */
export class ProductsListPage extends BasePage {
  readonly routeKey = "products" as const;
  readonly readyLocator: Locator;

  readonly tabAll: Locator;
  readonly tabActive: Locator;
  readonly tabInactive: Locator;

  readonly searchInput: Locator;
  readonly filterButton: Locator;

  readonly dataGrid: Locator;
  readonly gridRows: Locator;

  readonly bulkActionsDropdown: Locator;
  readonly uploadButton: Locator;
  readonly importCsvButton: Locator;
  readonly exportCsvButton: Locator;

  readonly paginationNext: Locator;
  readonly paginationPrevious: Locator;

  constructor(page: Page) {
    super(page);
    const l = this.profile.labels;
    const s = this.profile.selectorHints;

    this.readyLocator = this.mainContent
      .getByRole("tab")
      .first()
      .or(this.mainGetByRole("heading", { name: /products/i }))
      .or(this.mainContent.locator(s.dataGrid))
      .first();

    this.tabAll = this.mainGetByRole("tab", { name: l.tabs.all })
      .or(this.mainGetByText(l.tabs.all))
      .first();
    this.tabActive = this.mainGetByRole("tab", { name: l.tabs.active })
      .or(this.mainGetByText(l.tabs.active))
      .first();
    this.tabInactive = this.mainGetByRole("tab", { name: l.tabs.inactive })
      .or(this.mainGetByText(l.tabs.inactive))
      .first();

    this.searchInput = this.mainContent
      .getByPlaceholder(l.search.placeholder)
      .or(this.mainContent.locator("input[type='search'], input[type='text']"))
      .first();

    this.filterButton = this.mainGetByRole("button", { name: l.buttons.filter }).first();

    this.dataGrid = this.mainContent.locator(s.dataGrid).first();
    this.gridRows = this.mainContent.locator(s.gridRow);

    this.bulkActionsDropdown = this.mainGetByRole("button", {
      name: l.buttons.bulkAction,
    }).first();
    this.uploadButton = this.mainGetByRole("button", { name: l.buttons.upload }).first();
    this.importCsvButton = this.mainGetByRole("button", { name: l.buttons.import }).first();
    this.exportCsvButton = this.mainGetByRole("button", { name: l.buttons.export }).first();

    this.paginationNext = this.mainGetByRole("button", { name: l.buttons.next })
      .or(this.mainContent.locator("[class*='Pagination'] button:last-child"))
      .first();
    this.paginationPrevious = this.mainGetByRole("button", { name: l.buttons.previous })
      .or(this.mainContent.locator("[class*='Pagination'] button:first-child"))
      .first();
  }

  /** Type into the search field and wait for grid to refresh. */
  async searchProduct(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
    await this.waitForNetworkIdle();
  }

  /**
   * Locate a product by its SKU (or whatever the active profile calls the
   * primary id — see `profile.entityNames.productId`) and open its edit page.
   *
   * This is the stable alternative to "first row" targeting. Every seller/ecomm
   * list we've tested re-sorts after each edit, so "first row" is different on
   * every run. Searching by id pins the test to one product.
   */
  async searchAndOpenBySku(id: string): Promise<void> {
    await this.open();
    await this.searchProduct(id);
    const matchingRow = this.findRowByIdExact(id);
    await matchingRow.waitFor({ state: "visible", timeout: 15_000 });
    const titleButton = matchingRow.getByRole("button").filter({ hasText: /\S{2,}/ }).first();
    await titleButton.click({ timeout: 10_000 });
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .getByRole("heading", { name: this.profile.labels.headings.basicInformation })
      .or(this.page.locator("main").getByText(/^(Title|Price|Description)$/).first())
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
  }

  /**
   * Find the single row whose primary id EXACTLY matches the given value.
   * Uses the profile's skuRowPattern template, filled with the escaped id.
   * Word-boundary lookahead prevents e.g. id "123" from matching "12345".
   */
  private findRowByIdExact(id: string): Locator {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patternSrc = this.profile.selectorHints.skuRowPattern.replace("{value}", escaped);
    const pattern = new RegExp(patternSrc, "i");
    return this.mainContent.getByRole("row").filter({ hasText: pattern }).first();
  }

  /**
   * Same lookup but selects the row via checkbox (for Bulk Action flows).
   * Optionally switches to a specific tab first.
   */
  async searchAndSelectBySku(
    id: string,
    opts: { tab?: string } = {}
  ): Promise<Locator> {
    await this.open();
    if (opts.tab) {
      const tabLocator = this.mainContent
        .getByRole("tab", {
          name: new RegExp(`^${opts.tab.replace(" ", "\\s*")}\\s*\\d*`, "i"),
        })
        .first();
      await tabLocator.click({ timeout: 10_000 });
      await this.waitForNetworkIdle();
    }
    await this.searchProduct(id);
    const matchingRow = this.findRowByIdExact(id);
    await matchingRow.waitFor({ state: "visible", timeout: 15_000 });
    const checkbox = matchingRow.getByRole("checkbox").first();
    if (!(await checkbox.isChecked().catch(() => false))) {
      await checkbox.click({ timeout: 10_000 });
    }
    await this.page.waitForTimeout(300);
    return matchingRow;
  }

  async open(): Promise<void> {
    await this.navigate();
    await this.waitForNetworkIdle(15_000);
    await this.waitForReady();
  }

  async selectTab(tab: "All" | "Active" | "Inactive"): Promise<void> {
    const map = { All: this.tabAll, Active: this.tabActive, Inactive: this.tabInactive };
    await this.clickReliably(map[tab]);
    await this.waitForNetworkIdle();
  }

  async getRowCount(): Promise<number> {
    await this.waitForNetworkIdle();
    return this.gridRows.count();
  }

  async openFirstProductEdit(): Promise<void> {
    await this.open();
    const firstLink = this.mainContent
      .locator(this.profile.selectorHints.rowTitleLink)
      .first();
    await firstLink.waitFor({ state: "visible", timeout: 15_000 });
    await firstLink.click({ timeout: 10_000 });
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .getByRole("heading", { name: this.profile.labels.headings.basicInformation })
      .or(this.page.locator("main").getByText(/^(Title|Price|Description)$/).first())
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
  }
}
