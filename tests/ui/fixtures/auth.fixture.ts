import { test as base, type Page, type BrowserContext } from "@playwright/test";
import { openAuthenticatedDashboard } from "../helpers/auth-helper.js";
import { reduceClickInterference } from "../helpers/reliable-action.js";
import { DashboardPage } from "../pages/dashboard.page.js";
import { ProductsListPage } from "../pages/products/products-list.page.js";
import { ProductEditPage } from "../pages/products/product-edit.page.js";
import { OrdersListPage } from "../pages/orders/orders-list.page.js";
import { OrderViewPage } from "../pages/orders/order-view.page.js";
import { ReturnsListPage } from "../pages/returns/returns-list.page.js";
import { ConfigPage } from "../pages/config.page.js";
import { PricingPage } from "../pages/pricing.page.js";
import { ActivitiesPage } from "../pages/activities.page.js";

/**
 * Worker-scoped auth fixture — login ONCE per worker, share the page across tests.
 *
 * Why worker-scoped (not test-scoped): logging in repeatedly is the single
 * largest waste in a Playwright suite. With workers=1, this means one login
 * per `npm run test:ui` invocation total.
 *
 * Receiving QAs: do not modify this file unless your auth flow needs a custom
 * step we don't yet model. Instead, configure your profile's `auth` block.
 */

type PomFixtures = {
  authenticatedPage: Page;
  dashboardPage: DashboardPage;
  productsPage: ProductsListPage;
  productEditPage: ProductEditPage;
  ordersPage: OrdersListPage;
  orderViewPage: OrderViewPage;
  returnsPage: ReturnsListPage;
  configPage: ConfigPage;
  pricingPage: PricingPage;
  activitiesPage: ActivitiesPage;
};

type PomWorkerFixtures = {
  sharedAuthContext: BrowserContext;
  sharedAuthPage: Page;
};

export const test = base.extend<PomFixtures, PomWorkerFixtures>({
  sharedAuthContext: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      await openAuthenticatedDashboard(page);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await reduceClickInterference(page);
      await use(context);
      await context.close();
    },
    { scope: "worker", timeout: 300_000 },
  ],

  sharedAuthPage: [
    async ({ sharedAuthContext }, use) => {
      const pages = sharedAuthContext.pages();
      await use(pages[0]);
    },
    { scope: "worker" },
  ],

  authenticatedPage: async ({ sharedAuthPage }, use) => {
    await use(sharedAuthPage);
  },

  dashboardPage: async ({ authenticatedPage }, use) => {
    await use(new DashboardPage(authenticatedPage));
  },
  productsPage: async ({ authenticatedPage }, use) => {
    await use(new ProductsListPage(authenticatedPage));
  },
  productEditPage: async ({ authenticatedPage }, use) => {
    await use(new ProductEditPage(authenticatedPage));
  },
  ordersPage: async ({ authenticatedPage }, use) => {
    await use(new OrdersListPage(authenticatedPage));
  },
  orderViewPage: async ({ authenticatedPage }, use) => {
    await use(new OrderViewPage(authenticatedPage));
  },
  returnsPage: async ({ authenticatedPage }, use) => {
    await use(new ReturnsListPage(authenticatedPage));
  },
  configPage: async ({ authenticatedPage }, use) => {
    await use(new ConfigPage(authenticatedPage));
  },
  pricingPage: async ({ authenticatedPage }, use) => {
    await use(new PricingPage(authenticatedPage));
  },
  activitiesPage: async ({ authenticatedPage }, use) => {
    await use(new ActivitiesPage(authenticatedPage));
  },
});

export { expect } from "@playwright/test";
