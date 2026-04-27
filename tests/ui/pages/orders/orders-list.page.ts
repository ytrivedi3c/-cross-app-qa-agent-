import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class OrdersListPage extends BasePage {
  readonly routeKey = "orders" as const;
  readonly readyLocator: Locator;

  readonly dataGrid: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    const s = this.profile.selectorHints;
    const l = this.profile.labels;

    this.readyLocator = this.mainGetByRole("heading", { name: /orders/i })
      .or(this.mainContent.locator(s.dataGrid))
      .first();

    this.dataGrid = this.mainContent.locator(s.dataGrid).first();
    this.searchInput = this.mainContent.getByPlaceholder(l.search.placeholder).first();
  }
}
