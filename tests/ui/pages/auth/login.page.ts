import type { Page, Locator } from "@playwright/test";
import { BasePage } from "../base.page.js";
import type { AppProfile } from "../../config/app-profile.js";

/**
 * Login POM — shape varies a lot by auth method.
 *
 * The main entry point is `openAuthenticatedDashboard` in the auth fixture,
 * which reads `profile.auth.method` and picks the right flow. This POM is
 * only the form-login shape; JWT-query-param apps skip it entirely.
 */
export class LoginPage extends BasePage {
  readonly routeKey = "dashboard" as const; // login has no route entry of its own
  readonly readyLocator: Locator;

  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.readyLocator = this.mainGetByRole("heading", { name: /sign\s*in|log\s*in/i })
      .or(this.mainContent.getByPlaceholder(/email|username/i))
      .first();

    this.usernameInput = this.mainContent
      .getByLabel(/email|username/i)
      .or(this.mainContent.getByPlaceholder(/email|username/i))
      .first();
    this.passwordInput = this.mainContent
      .getByLabel(/password/i)
      .or(this.mainContent.locator("input[type='password']"))
      .first();
    this.submitButton = this.mainGetByRole("button", { name: /sign\s*in|log\s*in|submit/i }).first();
  }

  async submitForm(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.clickReliably(this.submitButton);
  }
}
