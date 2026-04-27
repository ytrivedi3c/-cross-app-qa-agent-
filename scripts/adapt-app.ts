#!/usr/bin/env tsx
/**
 * adapt-app — startup wizard for onboarding a new app to this test suite.
 *
 * Run: `npm run adapt-app`
 *
 * Asks the receiving QA for the basics (URL, port, auth method, feature
 * routes), writes a seed profile + empty SKU config, and prints clear next
 * steps. Each prompt explains WHY we ask — the rationale comes from real
 * problems the original suite hit (logged in the cross-app-profile-adapter
 * skill's "Gotchas we've suffered" section).
 *
 * The adaptation agent (Layer 3) fills in label/selector hints by probing
 * the live app via Playwright + Claude API. The wizard offers to launch it
 * at the end; the QA can also run it later via `npm run adapt-app-agent`.
 */

import { promises as fs } from "fs";
import path from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

const rl = createInterface({ input, output });

// ─── small CLI helpers ──────────────────────────────────────────────────────

function note(msg: string): void {
  console.log(`  ℹ  ${msg}`);
}

function header(msg: string): void {
  console.log(`\n${msg}\n${"─".repeat(msg.length)}`);
}

async function ask(question: string, opts: { default?: string; required?: boolean } = {}): Promise<string> {
  const def = opts.default ? ` [${opts.default}]` : "";
  const ans = (await rl.question(`? ${question}${def}: `)).trim();
  if (!ans) {
    if (opts.default !== undefined) return opts.default;
    if (opts.required) {
      console.log("  This field is required. Please enter a value.");
      return ask(question, opts);
    }
    return "";
  }
  return ans;
}

async function askChoice(question: string, choices: { key: string; label: string; why?: string }[]): Promise<string> {
  console.log(`? ${question}`);
  for (const c of choices) {
    console.log(`    ${c.key}) ${c.label}${c.why ? `  — ${c.why}` : ""}`);
  }
  const valid = choices.map((c) => c.key);
  const ans = (await rl.question(`  choose [${valid.join("/")}]: `)).trim();
  if (!valid.includes(ans)) {
    console.log("  Invalid choice. Try again.");
    return askChoice(question, choices);
  }
  return ans;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  cross-app-qa-agent — wizard for onboarding a new app         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  note("Every question explains WHY we ask. Read the notes — they encode real");
  note("flakiness sources we've already burned hours on. Defaults in [brackets].");

  // ─── App identity ─────────────────────────────────────────────────────────
  header("1) App identity");
  const slug = await ask(
    'App slug (lowercase, no spaces — becomes "<slug>.ts" in app-profiles/)',
    { required: true }
  );
  const displayName = await ask("Display name (human-readable, shown in reports)", {
    default: slug,
  });

  // ─── Endpoint ─────────────────────────────────────────────────────────────
  header("2) Endpoint");
  note("Base URL is the protocol + host + port — no trailing slash.");
  note('Local dev example: "http://localhost:3000". Staging: "https://app.example.com".');
  const baseUrl = await ask("Base URL", { required: true });

  // ─── Auth ─────────────────────────────────────────────────────────────────
  header("3) Authentication");
  note("From experience: JWT-via-query-param is the most reliable for SPA");
  note('apps. We learned the hard way that navigating to "/panel/<id>/dashboard"');
  note("directly often triggers 'Session Expired' because the API rejects");
  note("an unverified JWT. Hitting the login route first forces validation.");

  const authChoice = await askChoice("Auth method", [
    { key: "1", label: "JWT query-param", why: "fastest; recommended if your app supports it" },
    { key: "2", label: "Form login", why: "username + password" },
    { key: "3", label: "OAuth manual", why: "external IdP; pauses for human" },
  ]);
  const authMethod =
    authChoice === "1" ? "jwt-query-param" : authChoice === "2" ? "form-login" : "oauth-manual";

  let loginPathPattern = "";
  let tokenEnvVar: string | undefined;

  if (authMethod === "jwt-query-param") {
    note('Login URL TEMPLATE: include "{token}" where the JWT goes.');
    note('Example: "/auth/login?user_token={token}"');
    loginPathPattern = await ask("Login path pattern", {
      default: "/auth/login?user_token={token}",
      required: true,
    });
    note("Each app gets its own env var name so creds don't collide.");
    note('Example: "MYAPP_ACCESS_TOKEN". Set it in your local .env (gitignored).');
    tokenEnvVar = await ask("Token env var name", {
      default: `${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_ACCESS_TOKEN`,
      required: true,
    });
  } else if (authMethod === "form-login") {
    loginPathPattern = await ask("Login path", { default: "/login", required: true });
    note("Set APP_USERNAME and APP_PASSWORD in your local .env at runtime.");
  } else {
    loginPathPattern = await ask("Initial login path (where OAuth flow starts)", {
      default: "/login",
      required: true,
    });
  }

  note("Panel path pattern matches '<origin>/<panel-prefix>' so feature routes");
  note('hang off it. For per-user panels: /^(https?:\\/\\/[^/]+\\/panel\\/[^/]+)/');
  note('For apps without a per-user panel: just /^(https?:\\/\\/[^/]+)/');
  const panelPathPatternStr = await ask("Panel path regex (as RegExp source)", {
    default: "^(https?:\\/\\/[^/]+\\/panel\\/[^/]+)",
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  header("4) Feature routes");
  note("Each route is appended to the panel base after login. Every app in");
  note("scope must have all of these — the whole point of this agent is that");
  note("functionality is shared across apps; only the URL paths differ.");

  const dashboard = await ask("Dashboard path", { default: "/dashboard", required: true });
  const products = await ask("Products list path", { default: "/listing/products", required: true });
  const orders = await ask("Orders list path", { default: "/listing/orders", required: true });
  const returns = await ask("Returns list path", { default: "/listing/returns", required: true });
  const config = await ask("Config / settings path", { default: "/settings", required: true });
  const pricing = await ask("Pricing / plans path", { default: "/pricing", required: true });
  const activities = await ask("Activities / events path", { default: "/activities", required: true });

  // ─── Entity name ──────────────────────────────────────────────────────────
  header("5) Primary entity name");
  note("What does your app call the primary product key? SKU on most apps.");
  note('ASIN on Amazon. "item_id" on some marketplaces. Used in row-targeting.');
  const productId = await ask('Product id field name', { default: "sku" });

  // ─── Runtime preferences (optional) ───────────────────────────────────────
  header("6) Runtime");
  const viewport = await ask("Viewport width x height", { default: "1920x1080" });

  // ─── Confirm and write ────────────────────────────────────────────────────
  header("Summary");
  console.log(`  slug:           ${slug}`);
  console.log(`  display name:   ${displayName}`);
  console.log(`  baseUrl:        ${baseUrl}`);
  console.log(`  auth.method:    ${authMethod}`);
  console.log(`  auth.path:      ${loginPathPattern}`);
  if (tokenEnvVar) console.log(`  auth.tokenEnvVar: ${tokenEnvVar}`);
  console.log(`  panelPattern:   /${panelPathPatternStr}/`);
  console.log(`  routes:         dashboard=${dashboard}, products=${products}, ...`);
  console.log(`  productId:      ${productId}`);
  console.log(`  viewport:       ${viewport}`);

  const confirm = await ask("Write profile + sku config? [y/N]", { default: "n" });
  if (!/^y(es)?$/i.test(confirm)) {
    console.log("\nAborted. Nothing written.");
    rl.close();
    return;
  }

  await writeSeedProfile({
    slug,
    displayName,
    baseUrl,
    authMethod,
    loginPathPattern,
    tokenEnvVar,
    panelPathPatternStr,
    routes: { dashboard, products, orders, returns, config, pricing, activities },
    productId,
  });
  await writeSkuConfig(slug);

  console.log("\n✓ Wrote tests/ui/config/app-profiles/" + slug + ".ts");
  console.log("✓ Wrote tests/ui/config/test-sku-config." + slug + ".ts");

  header("Next steps");
  console.log(`  1. Set ${tokenEnvVar ?? "your auth env vars"} in .env (see .env.example).`);
  console.log(`  2. Set APP_PROFILE=${slug} in .env so tests pick this profile.`);
  console.log(`  3. (Optional but recommended) Run 'npm run adapt-app-agent' to`);
  console.log(`     auto-fill label / selector hints by probing your live app.`);
  console.log(`  4. Run smoke tests: APP_PROFILE=${slug} npm run test:ui -- --grep SMOKE`);
  console.log(`  5. Fill in sandbox SKUs in tests/ui/config/test-sku-config.${slug}.ts`);
  console.log(`     before running destructive tests (deactivate, delete, sync).`);

  rl.close();
}

interface SeedConfig {
  slug: string;
  displayName: string;
  baseUrl: string;
  authMethod: string;
  loginPathPattern: string;
  tokenEnvVar?: string;
  panelPathPatternStr: string;
  routes: {
    dashboard: string;
    products: string;
    orders: string;
    returns: string;
    config: string;
    pricing: string;
    activities: string;
  };
  productId: string;
}

async function writeSeedProfile(c: SeedConfig): Promise<void> {
  const filePath = path.resolve("tests", "ui", "config", "app-profiles", `${c.slug}.ts`);
  // Defaults for label/selectorHint fields — adaptation agent will refine.
  const content = `/**
 * AppProfile for ${c.displayName} — generated by 'npm run adapt-app' wizard.
 *
 * Routes + auth filled in from your wizard answers.
 * Labels + selectorHints currently use generic seller/ecomm defaults.
 *
 * To refine labels/hints from your live app's actual UI:
 *   APP_PROFILE=${c.slug} npm run adapt-app-agent
 *
 * To run smoke tests against this profile:
 *   APP_PROFILE=${c.slug} npm run test:ui -- --grep SMOKE
 */

import type { AppProfile } from "../app-profile.js";

const profile: AppProfile = {
  id: ${JSON.stringify(c.slug)},
  domain: "seller-ecomm",
  displayName: ${JSON.stringify(c.displayName)},
  baseUrl: ${JSON.stringify(c.baseUrl)},

  auth: {
    method: ${JSON.stringify(c.authMethod)} as AppProfile["auth"]["method"],
    loginPathPattern: ${JSON.stringify(c.loginPathPattern)},${
    c.tokenEnvVar ? `\n    tokenEnvVar: ${JSON.stringify(c.tokenEnvVar)},` : ""
  }
    panelPathPattern: /${c.panelPathPatternStr}/,
  },

  routes: {
    dashboard: ${JSON.stringify(c.routes.dashboard)},
    products: ${JSON.stringify(c.routes.products)},
    orders: ${JSON.stringify(c.routes.orders)},
    returns: ${JSON.stringify(c.routes.returns)},
    config: ${JSON.stringify(c.routes.config)},
    pricing: ${JSON.stringify(c.routes.pricing)},
    activities: ${JSON.stringify(c.routes.activities)},
  },

  // ─── DEFAULTS — adaptation agent will refine these from your live app ────
  labels: {
    tabs: {
      all: /^all$/i,
      active: /^active$/i,
      inactive: /^inactive$/i,
      live: /^live$/i,
      notUploaded: /^not\\s*uploaded$/i,
      inProgress: /^in\\s*progress$/i,
      reviewing: /^reviewing$/i,
      failed: /^failed$/i,
    },
    buttons: {
      upload: /upload/i,
      bulkAction: /bulk\\s*action|more\\s*action/i,
      filter: /^filter$/i,
      save: /^save$/i,
      cancel: /^cancel$/i,
      confirm: /confirm|ok|yes/i,
      next: /^next$/i,
      previous: /^(prev|previous)$/i,
      import: /^import/i,
      export: /^export/i,
    },
    search: { placeholder: /search/i },
    headings: {
      basicInformation: /basic\\s*information|product\\s*details/i,
      productStatus: /product\\s*status/i,
      orderStatus: /order\\s*status/i,
    },
  },

  selectorHints: {
    dataGrid: "table, [class*='DataTable'], [class*='Grid']",
    gridRow: "table tbody tr, [class*='DataTable'] [class*='Row']",
    modalDialog: "[role='dialog'], [class*='Modal'], [class*='Dialog']",
    skuRowPattern: "${c.productId.toUpperCase()}\\\\s*:?\\\\s*{value}(?!\\\\d)",
    rowTitleLink: "[class*='dataTable'] a, [class*='DataTable'] a, tbody tr a",
  },

  entityNames: {
    productId: ${JSON.stringify(c.productId)},
  },
};

export default profile;
`;
  await fs.writeFile(filePath, content, "utf8");
}

async function writeSkuConfig(slug: string): Promise<void> {
  const filePath = path.resolve("tests", "ui", "config", `test-sku-config.${slug}.ts`);
  const content = `/**
 * TEST SKU configuration for ${slug}.
 *
 * Fill these slots with sandbox product ids from your app. Empty slots
 * will fail tests LOUDLY via requireSku() — never silently fall back.
 *
 * Why dedicated sandbox products: every seller/ecomm list re-sorts after
 * each edit, so "first row" is unstable. SKU-anchored targeting pins each
 * test to a specific product. (See sku-anchored-test-targeting skill.)
 */

export const TEST_SKUS = {
  saveFlowLive: "",         // non-destructive edit-and-restore
  deactivateModal: "",      // modal open + cancel
  deactivateSuccess: "",    // destructive but reversible
  deleteModal: "",          // modal cancel
  deleteSuccess: "",        // one-shot delete
  syncTarget: "",           // async; verified at suite end
  uploadTarget: "",
  statusReferenceLive: "",
  statusReferenceInactive: "",
} as const;

export function requireSku(slot: keyof typeof TEST_SKUS): string {
  const v = TEST_SKUS[slot];
  if (!v) throw new Error(\`[test-sku-config.${slug}] "\${slot}" is empty.\`);
  return v;
}
`;
  await fs.writeFile(filePath, content, "utf8");
}

main().catch((err) => {
  console.error("\n[adapt-app] Wizard failed:", err);
  process.exit(1);
});
