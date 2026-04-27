import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page.js";

export class ConfigPage extends BasePage {
  readonly routeKey = "config" as const;
  readonly readyLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.readyLocator = this.mainGetByRole("heading", {
      name: /settings|configuration|config/i,
    }).first();
  }
}
