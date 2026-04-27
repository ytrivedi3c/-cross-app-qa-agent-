import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class ReturnsListPage extends BasePage {
  readonly routeKey = "returns" as const;
  readonly readyLocator: Locator;

  readonly dataGrid: Locator;

  constructor(page: Page) {
    super(page);
    const s = this.profile.selectorHints;

    this.readyLocator = this.mainGetByRole("heading", { name: /returns/i })
      .or(this.mainContent.locator(s.dataGrid))
      .first();

    this.dataGrid = this.mainContent.locator(s.dataGrid).first();
  }
}
