import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page.js";

export class PricingPage extends BasePage {
  readonly routeKey = "pricing" as const;
  readonly readyLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.readyLocator = this.mainGetByRole("heading", { name: /pricing|plans|billing/i }).first();
  }
}
