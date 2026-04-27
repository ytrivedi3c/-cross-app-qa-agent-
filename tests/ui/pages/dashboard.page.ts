import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page.js";

export class DashboardPage extends BasePage {
  readonly routeKey = "dashboard" as const;
  readonly readyLocator: Locator;

  readonly productStatusCard: Locator;
  readonly orderStatusCard: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    super(page);
    const h = this.profile.labels.headings;

    this.readyLocator = this.mainGetByRole("heading", { name: h.productStatus })
      .or(this.mainGetByText(h.productStatus))
      .first();

    this.productStatusCard = this.mainGetByText(h.productStatus).first();
    this.orderStatusCard = h.orderStatus
      ? this.mainGetByText(h.orderStatus).first()
      : this.mainGetByText(/order/i).first();

    this.refreshButton = this.mainGetByRole("button", { name: /refresh/i }).first();
  }
}
