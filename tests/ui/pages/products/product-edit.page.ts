import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";

export class ProductEditPage extends BasePage {
  readonly routeKey = "products" as const;
  readonly readyLocator: Locator;

  readonly titleInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    const l = this.profile.labels;
    this.readyLocator = this.mainGetByRole("heading", {
      name: l.headings.basicInformation,
    })
      .or(this.mainGetByText(/^(Title|Price|Description)$/).first())
      .first();

    this.titleInput = this.mainContent
      .getByLabel(/title/i)
      .or(this.mainContent.getByPlaceholder(/title/i))
      .first();

    this.saveButton = this.mainGetByRole("button", { name: l.buttons.save }).first();
    this.cancelButton = this.mainGetByRole("button", { name: l.buttons.cancel }).first();
  }

  async getTitle(): Promise<string> {
    return this.titleInput.inputValue();
  }

  async setTitle(value: string): Promise<void> {
    await this.titleInput.fill(value);
  }

  async save(): Promise<void> {
    await this.clickReliably(this.saveButton);
  }
}
