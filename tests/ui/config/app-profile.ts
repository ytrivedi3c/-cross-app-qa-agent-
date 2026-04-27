/**
 * AppProfile — the single abstraction that makes this test suite portable.
 *
 * Every string that would otherwise be hardcoded to one specific app
 * (routes, tab labels, button text, auth path shape, grid row class
 * patterns) lives in a profile. POMs read from `getActiveProfile()`
 * instead of hardcoding, so the same POM works against any app that
 * ships a matching profile.
 *
 * ─── HOW TO ADD A NEW APP ─────────────────────────────────────────────────
 *
 * 1. Run `npm run adapt-app` and follow the wizard. It will create
 *    `tests/ui/config/app-profiles/<your-slug>.ts` for you.
 * 2. Set `APP_PROFILE=<your-slug>` in your .env (or shell).
 * 3. Run `npm run test:ui`.
 *
 * ─── WHY THIS SHAPE ───────────────────────────────────────────────────────
 *
 * Lessons baked in from building the original suite (see the
 * cross-app-profile-adapter skill for full rationale):
 *
 *  - `labels` are RegExp, not strings: semantic matches (/active/i) are
 *    resilient to small UI wording changes AND to localisation.
 *  - `selectorHints.skuRowPattern` is a template, not a raw selector:
 *    each app may label the primary entity differently (SKU vs item_id
 *    vs ASIN). The pattern is applied per-lookup so we never pin SKU
 *    "123" to a row containing "12345".
 *  - `auth.tokenEnvVar` is a name, not a value: credentials NEVER live
 *    in the profile file (which is committed); they live in .env (which
 *    isn't).
 */

export interface AppProfile {
  /** Unique slug — also the filename in app-profiles/. */
  readonly id: string;

  /** Narrows which POMs/specs make sense. Currently only "seller-ecomm". */
  readonly domain: "seller-ecomm";

  /** Human-readable display name for the adaptation reports + README. */
  readonly displayName: string;

  /**
   * Optional static base URL (e.g. "https://app.example.com" or
   * "http://localhost:3000"). If unset, falls back to the APP_BASE_URL env
   * var, then to http://localhost:3000. Profiles usually set this so every
   * QA on the team doesn't have to export APP_BASE_URL individually.
   */
  readonly baseUrl?: string;

  readonly auth: {
    /**
     * - "jwt-query-param": login via URL with ?token= (fastest, no form).
     * - "form-login": HTML form with username/password.
     * - "oauth-manual": redirects externally — wizard pauses for a human.
     */
    method: "jwt-query-param" | "form-login" | "oauth-manual";

    /**
     * Template for the login URL. Use `{token}` as the placeholder when
     * `method === "jwt-query-param"`. Examples:
     *   "/auth/login?user_token={token}"  (TikTok Shop original)
     *   "/signin?jwt={token}"              (another app)
     *   "/login"                           (form-login has no token)
     */
    loginPathPattern: string;

    /**
     * Env var name that holds the JWT/access token (for jwt-query-param).
     * Each app gets its own so one machine can hold creds for multiple.
     * Example: "SELLER_ACCESS_TOKEN", "LYNX_TOKEN".
     */
    tokenEnvVar?: string;

    /**
     * Regex that extracts the "panel base" from the current URL after
     * login, used as the prefix for feature routes. For apps with
     * per-user panel paths ("/panel/abc123/dashboard"), set this to
     * match through the user id. Otherwise set to match just the origin.
     */
    panelPathPattern: RegExp;
  };

  /**
   * Feature routes — appended to `panelBase` (or `baseUrl` directly if no
   * panel pattern applies). Every app in scope must expose all of these.
   */
  readonly routes: {
    dashboard: string;
    products: string;
    orders: string;
    returns: string;
    config: string;
    pricing: string;
    activities: string;
  };

  readonly labels: {
    tabs: {
      all: RegExp;
      active: RegExp;
      inactive: RegExp;
      /** Statuses specific to seller/ecomm — may or may not all apply per app. */
      live?: RegExp;
      notUploaded?: RegExp;
      inProgress?: RegExp;
      reviewing?: RegExp;
      failed?: RegExp;
    };
    buttons: {
      upload: RegExp;
      bulkAction: RegExp;
      filter: RegExp;
      save: RegExp;
      cancel: RegExp;
      confirm: RegExp;
      next: RegExp;
      previous: RegExp;
      import: RegExp;
      export: RegExp;
    };
    search: {
      placeholder: RegExp;
    };
    headings: {
      /** The edit page section that holds title/price/description. */
      basicInformation: RegExp;
      productStatus: RegExp;
      orderStatus?: RegExp;
    };
  };

  readonly selectorHints: {
    /** CSS for the primary list grid on any list view. */
    dataGrid: string;
    /** CSS for one grid row. Multiple selectors OK (comma-separated). */
    gridRow: string;
    /** CSS for modal dialog containers. */
    modalDialog: string;
    /**
     * Regex template for locating a row by its unique id. `{value}` is the
     * placeholder. Example: "SKU\\s*:?\\s*{value}(?!\\d)" — matches
     * "SKU: 123" but NOT "SKU: 12345" when asked for "123".
     */
    skuRowPattern: string;
    /**
     * CSS for the row-title link that opens edit page. Varies a lot by
     * app/framework (Ant Design vs MUI vs custom). Multiple fallbacks OK.
     */
    rowTitleLink: string;
  };

  readonly entityNames: {
    /** What the primary product key is called in this app's UI and docs. */
    productId: "sku" | "asin" | "item_id" | string;
  };
}

/**
 * The currently active profile, selected by APP_PROFILE env var.
 *
 * Profiles live at tests/ui/config/app-profiles/<slug>.ts and are loaded
 * lazily (require-at-call-time) so that unused profiles don't need to
 * exist just to compile.
 */
export function getActiveProfile(): AppProfile {
  const slug = process.env.APP_PROFILE?.trim() || "example";
  try {
    // Dynamic require so TS doesn't demand every profile exist at compile time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`./app-profiles/${slug}.js`);
    const profile: AppProfile | undefined = mod.default ?? mod.profile;
    if (!profile) {
      throw new Error(
        `[app-profile] File tests/ui/config/app-profiles/${slug}.ts exists but does not export a default AppProfile.`
      );
    }
    return profile;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "MODULE_NOT_FOUND") {
      throw new Error(
        `[app-profile] APP_PROFILE="${slug}" — no file at tests/ui/config/app-profiles/${slug}.ts.\n` +
          `Available: run \`ls tests/ui/config/app-profiles/\`. Or run \`npm run adapt-app\` to create one.`
      );
    }
    throw err;
  }
}
