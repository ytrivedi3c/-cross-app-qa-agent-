import { getActiveProfile } from "../tests/ui/config/app-profile.js";

/**
 * Decode a JWT payload (client-side, unverified) to extract the panel/user id.
 *
 * Generalized from the original QA-automation helper: the env var name is no longer
 * hardcoded — it's supplied by the active AppProfile's `auth.tokenEnvVar` field, so
 * each deployed app can use its own token variable name.
 */

export function parseJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserIdFromJwt(token: string): string | undefined {
  const p = parseJwtPayloadUnsafe(token);
  const id = p?.user_id ?? p?.userId ?? p?.sub;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Read the auth token from the env var named by the active profile.
 * Returns undefined if the profile uses non-JWT auth or the var is empty.
 */
export function getAuthTokenFromEnv(): string | undefined {
  const profile = getActiveProfile();
  const varName = profile.auth.tokenEnvVar;
  if (!varName) return undefined;
  const val = process.env[varName]?.trim();
  if (!val || val === "your_token_here") return undefined;
  return val;
}

/** Decoded user id from whatever env var the active profile declares. */
export function getPanelUserIdFromEnvJwt(): string | undefined {
  const token = getAuthTokenFromEnv();
  if (!token) return undefined;
  return getUserIdFromJwt(token);
}
