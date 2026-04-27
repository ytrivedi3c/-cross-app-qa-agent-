import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page.js";

export class ActivitiesPage extends BasePage {
  readonly routeKey = "activities" as const;
  readonly readyLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.readyLocator = this.mainGetByRole("heading", { name: /activity|activities|events/i }).first();
  }
}
