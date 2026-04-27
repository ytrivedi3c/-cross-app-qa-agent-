import { test, expect } from "../fixtures/auth.fixture.js";
import { TestReporter } from "../helpers/test-reporter.js";
import { getActiveProfile } from "../config/app-profile.js";

/**
 * Smoke specs — the baseline "is this app even reachable" tests.
 *
 * These are what every adapted profile must pass before more interesting
 * tests have any chance of working. Receiving QAs run these FIRST after
 * `npm run adapt-app` to validate their profile.
 *
 * Pattern:
 *   - One r.log first row = the target context (profile id, route, etc.)
 *   - Hard assertions only — no r.skip(), no try/catch swallows.
 */

const profile = getActiveProfile();

test.describe(`Smoke — ${profile.displayName} [${profile.id}]`, () => {
  test("SMOKE_01: dashboard loads and shows product-status heading", async ({
    authenticatedPage,
    dashboardPage,
  }) => {
    const r = new TestReporter(
      "SMOKE_01",
      "dashboard loads and shows product-status heading",
      "Dashboard route resolves and the productStatus heading from the active profile is visible"
    );
    r.log("Profile", "active app profile id", profile.id, "PASS");

    await dashboardPage.open();
    r.log("dashboard.open()", "navigate + waitForReady", "ok", "PASS");

    const heading = authenticatedPage.getByText(profile.labels.headings.productStatus).first();
    await expect(heading).toBeVisible({ timeout: 30_000 });
    r.log("Product Status heading", "visible on dashboard", "found", "PASS");

    await r.attach();
  });

  test("SMOKE_02: products list loads and grid is present", async ({
    productsPage,
  }) => {
    const r = new TestReporter(
      "SMOKE_02",
      "products list loads and grid is present",
      "Products route resolves; data grid locator is visible"
    );
    r.log("Profile", "active app profile id", profile.id, "PASS");

    await productsPage.open();
    r.log("productsPage.open()", "navigate + waitForReady", "ok", "PASS");

    await expect(productsPage.dataGrid).toBeVisible({ timeout: 30_000 });
    r.log("Data grid", "visible on products list", "found", "PASS");

    await r.attach();
  });

  test("SMOKE_03: products search field accepts input", async ({
    productsPage,
  }) => {
    const r = new TestReporter(
      "SMOKE_03",
      "products search field accepts input",
      "Search input is visible, accepts text, and the typed value persists"
    );
    r.log("Profile", "active app profile id", profile.id, "PASS");

    await productsPage.open();
    await expect(productsPage.searchInput).toBeVisible({ timeout: 15_000 });
    r.log("Search input", "visible on products list", "found", "PASS");

    await productsPage.searchInput.fill("smoketest-noop");
    const value = await productsPage.searchInput.inputValue();
    expect(value).toBe("smoketest-noop");
    r.log("Search fill", "input value persists", value, "PASS");

    await productsPage.searchInput.fill(""); // clean up
    await r.attach();
  });

  test("SMOKE_04: orders list page loads", async ({ ordersPage }) => {
    const r = new TestReporter(
      "SMOKE_04",
      "orders list page loads",
      "Orders route resolves; the orders ready locator is visible"
    );
    r.log("Profile", "active app profile id", profile.id, "PASS");

    await ordersPage.open();
    r.log("ordersPage.open()", "navigate + waitForReady", "ok", "PASS");

    await expect(ordersPage.dataGrid.or(ordersPage.readyLocator)).toBeVisible({
      timeout: 30_000,
    });
    r.log("Orders list", "ready locator visible", "ok", "PASS");

    await r.attach();
  });
});
