import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class OrderViewPage extends BasePage {
  readonly routeKey = "orders" as const;
  readonly readyLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.readyLocator = this.mainGetByRole("heading", { name: /order/i }).first();
  }
}
