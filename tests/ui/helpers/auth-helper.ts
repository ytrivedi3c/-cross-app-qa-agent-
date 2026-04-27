import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getActiveProfile } from "../config/app-profile.js";
import { getAuthTokenFromEnv } from "../../../src/seller-token.js";
import { getAppBaseUrl } from "../../../src/app-urls.js";
import { reduceClickInterference } from "./reliable-action.js";

/**
 * Generalized auth helper. Reads `profile.auth.method` and dispatches.
 *
 * Why this exists:
 *   The original QA-automation flow (TikTok Shop) used JWT query-param login.
 *   For receiving QAs we need to support form-login + OAuth too — but each
 *   profile picks ONE method. The dispatcher keeps the spec-side API clean:
 *   tests just call openAuthenticatedDashboard(page); the profile decides how.
 *
 * Lessons baked in (from QA-automation memory):
 *   - For JWT: navigate to /auth/login?token=… NEVER directly to a panel
 *     URL. Direct panel URLs trigger "Session Expired" because the API
 *     rejects unverified JWTs. The login route forces token validation.
 *   - Detect "Session Expired" in parallel with the dashboard-ready signal,
 *     and surface a helpful error message (env mismatch / stale token).
 *   - Suppress chat-widget overlays AFTER login lands (not before — the
 *     widget script may not be injected yet during the login redirect).
 */

export async function openAuthenticatedDashboard(page: Page): Promise<void> {
  const profile = getActiveProfile();

  switch (profile.auth.method) {
    case "jwt-query-param":
      await loginWithJwtQueryParam(page);
      break;
    case "form-login":
      await loginWithForm(page);
      break;
    case "oauth-manual":
      await loginWithOauthManual(page);
      break;
    default:
      throw new Error(`[auth] Unsupported auth.method: ${profile.auth.method}`);
  }

  await reduceClickInterference(page);
}

/** JWT in URL query param. Fastest, what the TikTok-shop original used. */
async function loginWithJwtQueryParam(page: Page): Promise<void> {
  const profile = getActiveProfile();
  const token = getAuthTokenFromEnv();
  if (!token) {
    throw new Error(
      `[auth] auth.method="jwt-query-param" but env var "${profile.auth.tokenEnvVar}" is empty.\n` +
        `Set it in your .env file. See .env.example for the shape.`
    );
  }

  const base = getAppBaseUrl();
  const loginPath = profile.auth.loginPathPattern.replace(
    "{token}",
    encodeURIComponent(token)
  );
  const loginUrl = `${base}${loginPath}`;

  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Wait for redirect into the panel/dashboard. The panelPathPattern from
  // the profile defines what counts as "logged in".
  await page
    .waitForURL(profile.auth.panelPathPattern, { timeout: 90_000 })
    .catch(() => {
      // Some apps don't have a panel-path pattern; fall back to dashboard URL match.
    });

  // If we landed on a pricing/onboarding intermediate, push to dashboard.
  const url = page.url();
  const pricingHit = /pricing|onboarding|welcome/i.test(url);
  if (pricingHit) {
    const panelMatch = url.match(profile.auth.panelPathPattern);
    if (panelMatch) {
      await page.goto(`${panelMatch[1]}${profile.routes.dashboard}`, {
        waitUntil: "load",
        timeout: 60_000,
      });
    }
  }

  await waitForDashboardOrFail(page);
}

/** HTML form login (username + password). Needs USERNAME/PASSWORD env vars. */
async function loginWithForm(page: Page): Promise<void> {
  const username = process.env.APP_USERNAME?.trim();
  const password = process.env.APP_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error(
      `[auth] auth.method="form-login" but APP_USERNAME and/or APP_PASSWORD env vars are empty.`
    );
  }

  const profile = getActiveProfile();
  const base = getAppBaseUrl();
  await page.goto(`${base}${profile.auth.loginPathPattern}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await page.getByLabel(/email|username/i)
    .or(page.getByPlaceholder(/email|username/i))
    .first()
    .fill(username);
  await page.getByLabel(/password/i)
    .or(page.locator("input[type='password']"))
    .first()
    .fill(password);
  await page.getByRole("button", { name: /sign\s*in|log\s*in|submit/i })
    .first()
    .click();

  await waitForDashboardOrFail(page);
}

/**
 * OAuth — pause and wait for a human to complete the flow in the visible
 * browser. Useful for headed dev runs; not appropriate for CI.
 */
async function loginWithOauthManual(page: Page): Promise<void> {
  const profile = getActiveProfile();
  const base = getAppBaseUrl();
  await page.goto(`${base}${profile.auth.loginPathPattern}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  console.log(
    "[auth] OAuth manual mode — complete the login in the browser window. " +
      "Will resume automatically once the dashboard loads."
  );

  await waitForDashboardOrFail(page, 600_000); // Generous 10-minute window.
}

/**
 * Poll for dashboard-ready; if a "Session Expired" / "Login required" message
 * appears first, surface a clear error.
 */
async function waitForDashboardOrFail(page: Page, timeout = 150_000): Promise<void> {
  const profile = getActiveProfile();
  const expired = page.getByText(/session expired|login required|please sign in/i);
  const dashReady = page
    .getByRole("heading", { name: profile.labels.headings.productStatus })
    .or(page.getByText(profile.labels.headings.productStatus))
    .first();

  const sessionExpiredMessage = [
    `[auth] Session Expired after login. The auth token was rejected.`,
    `Fix: get a fresh token from your backend, set "${profile.auth.tokenEnvVar}" in .env, and try again.`,
    `Make sure the token's environment matches the API your app points at.`,
  ].join(" ");

  await expect
    .poll(
      async () => {
        if (await expired.isVisible().catch(() => false)) {
          throw new Error(sessionExpiredMessage);
        }
        return dashReady.isVisible().catch(() => false);
      },
      { timeout, intervals: [250, 500, 1_000, 2_000] }
    )
    .toBe(true);
}

/** Get back to the dashboard after a test has navigated elsewhere. */
export async function ensureOnDashboard(page: Page): Promise<void> {
  const profile = getActiveProfile();
  const url = page.url();
  if (!url) return;

  // Already there — just wait for the ready signal.
  if (url.includes(profile.routes.dashboard)) {
    await page
      .getByRole("heading", { name: profile.labels.headings.productStatus })
      .or(page.getByText(profile.labels.headings.productStatus))
      .first()
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {});
    return;
  }

  const panelMatch = url.match(profile.auth.panelPathPattern);
  if (!panelMatch) return;
  await page.goto(`${panelMatch[1]}${profile.routes.dashboard}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page
    .getByRole("heading", { name: profile.labels.headings.productStatus })
    .or(page.getByText(profile.labels.headings.productStatus))
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
}
