#!/usr/bin/env tsx
/**
 * adapt-app-agent — probes your live app and refines the active profile's
 * labels + selectorHints by feeding screenshots + DOM outlines to Claude.
 *
 * Run: `APP_PROFILE=<slug> npm run adapt-app-agent`
 *
 * ─── STATUS: SKELETON ─────────────────────────────────────────────────────
 *
 * The wizard already writes a profile with sensible default labels/selectors
 * — most apps work fine on those defaults thanks to the regex/forgiving locator
 * style (the original POMs handle e.g. /active/i not "Active"). This agent
 * is the OPTIONAL refinement step for apps where defaults aren't enough.
 *
 * What it WILL do (next iteration):
 *   1. Load active profile via getActiveProfile()
 *   2. Launch Playwright headed, log in via auth-helper.openAuthenticatedDashboard
 *   3. For each route in profile.routes:
 *      a. navigate, waitForLoadState
 *      b. capture screenshot + compact DOM outline of <main>
 *      c. call Claude (claude-opus-4-7, prompt caching) with the field list
 *         + screenshot + DOM and ask for { field, regex/selector, confidence }
 *      d. validate each proposal against Playwright (resolve + isVisible)
 *         — drop confidence to 0 if it doesn't resolve
 *   4. Write refined profile + companion <slug>.report.md with screenshots
 *
 * Why we're not blocking on this: the wizard's defaults work for most
 * seller/ecomm apps. Receiving QAs can ship without ever running this.
 * Run it only if smoke tests start failing on label/selector mismatches.
 */

import { getActiveProfile } from "../tests/ui/config/app-profile.js";

async function main(): Promise<void> {
  const profile = getActiveProfile();
  console.log(`\n[adapt-app-agent] Active profile: ${profile.id} (${profile.displayName})`);
  console.log(`[adapt-app-agent] Routes to probe: ${Object.keys(profile.routes).join(", ")}\n`);

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" STATUS: not yet implemented (skeleton).");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" The wizard's default labels + selectorHints are usually");
  console.log(" sufficient because the regex-based locators are forgiving.");
  console.log(" Run smoke tests first:");
  console.log("");
  console.log(`     APP_PROFILE=${profile.id} npm run test:ui -- --grep SMOKE`);
  console.log("");
  console.log(" If they pass, you're done. If they fail with locator");
  console.log(" mismatches, refine the failing fields by hand in:");
  console.log("");
  console.log(`     tests/ui/config/app-profiles/${profile.id}.ts`);
  console.log("");
  console.log(" Or wait for the full agent implementation (LLM-driven probe).");
  console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("[adapt-app-agent] Failed:", err);
  process.exit(1);
});
