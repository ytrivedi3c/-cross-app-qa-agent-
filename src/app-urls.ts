import { getActiveProfile } from "../tests/ui/config/app-profile.js";

/**
 * Base URL + login URL helpers, profile-aware.
 *
 * Precedence for base URL:
 *   1. APP_BASE_URL env var (explicit override)
 *   2. profile.auth baseUrl (if the profile defines one)
 *   3. http://localhost:3000
 */

const DEFAULT_LOCAL_HOST = "localhost";

function localHostname(): string {
  return process.env.LOCAL_APP_HOST?.trim() || DEFAULT_LOCAL_HOST;
}

export function defaultLocalBaseUrl(): string {
  const port = process.env.LOCALHOST_PORT?.trim() || "3000";
  return `http://${localHostname()}:${port}`;
}

export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const profile = getActiveProfile();
  if (profile.baseUrl) return profile.baseUrl.replace(/\/$/, "");

  return defaultLocalBaseUrl();
}

/** Login URL prefix shaped per profile, with the auth token appended by callers. */
export function getAuthLoginBase(): string {
  const profile = getActiveProfile();
  const base = getAppBaseUrl();
  return base + profile.auth.loginPathPattern.replace("{token}", "");
}
