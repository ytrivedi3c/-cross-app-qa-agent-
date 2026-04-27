---
name: cross-app-profile-adapter
description: Adapt this Playwright test suite to any seller/ecomm dashboard via a swappable AppProfile. Wizard-driven onboarding (URL + auth + routes); embedded POMs + helpers + skills work unchanged across apps. Use when a new QA wants to point this repo at their own app, when authoring a new app profile, when investigating a failed locator (heal log), or when porting improvements from QA-automation upstream. Encodes the QA lessons the original suite paid for in flake hours so receiving QAs don't repeat them.
author: Yash Trivedi
---

# cross-app-profile-adapter

## What this is

A Playwright suite that runs the SAME test code against multiple functionally-similar apps by swapping a single data file (the `AppProfile`). Built as a distributable so other QAs at your company can clone and run on their own apps.

## Architecture in 4 lines

1. **`AppProfile`** — interface in [tests/ui/config/app-profile.ts](../../tests/ui/config/app-profile.ts). One per app. Routes, auth method, label regexes, selector hints.
2. **POMs** read from `getActiveProfile()` instead of hardcoding strings. Reference: [products-list.page.ts](../../tests/ui/pages/products/products-list.page.ts).
3. **Wizard** ([scripts/adapt-app.ts](../../scripts/adapt-app.ts)) asks for app basics and writes a seed profile.
4. **Active profile** chosen by `APP_PROFILE=<slug>` env var.

## Onboarding a new app

```bash
git clone <agent-repo> my-qa-workspace
cd my-qa-workspace
npm install
cp .env.example .env             # set ANTHROPIC_API_KEY + your auth token
npm run adapt-app                # interactive wizard
APP_PROFILE=<your-slug> npm run test:ui -- --grep SMOKE
```

If smoke tests pass: you're working. Fill SKU slots in `tests/ui/config/test-sku-config.<slug>.ts`, then run the full suite.

## Gotchas we've suffered (and how this suite already solves them)

These are paid-in-flake-hours lessons from the original QA-automation TikTok Shop suite. Each has a defense baked into the agent — DON'T disable them thinking you're cleaning up.

### 1. List re-sorts after every edit → "first row" is unstable

**Symptom:** test edits product A; product A jumps to top; next test runs and mutates A again instead of B. Each run targets different products.

**Defense:** [products-list.page.ts:`searchAndOpenBySku`](../../tests/ui/pages/products/products-list.page.ts) — search by id → exact-match row filter → click. Never use `gridRows.first()` for stateful tests. The `findRowByIdExact` private uses a word-boundary regex so id `"123"` doesn't match `"12345"`.

### 2. React in-memory state vs backend state

**Symptom:** test edits a field, hits save, asserts UI shows the new value → passes. Reload the page → old value. Backend didn't actually save.

**Defense:** the **save-reload-restore** pattern. After save, `page.goto(editUrl)` to clear React state, THEN assert the value persists. Then restore original. Hard signal for "save succeeded" is **the Save button transitioning enabled→disabled**, not toast detection (toast libs vary; toasts auto-dismiss; save-button-disabled is deterministic).

### 3. Silent skip = false-green

**Symptom:** test wraps actions in `try/catch ... .catch(() => false)` then asserts `truthy`. Looks green. Never actually clicked the button.

**Defense:** suite policy — no `r.skip()`, no swallow-and-pass. Either the test does the action and asserts hard, or it fails. The [healing-locator.ts](../../tests/ui/helpers/healing-locator.ts) helper enforces this at the locator layer: `trySelectors` either resolves to a candidate or THROWS with evidence; never silently substitutes.

### 4. Direct panel URLs trigger Session Expired

**Symptom:** navigate to `/panel/<id>/dashboard` with a JWT in env → API rejects → "Session Expired" banner.

**Defense:** [auth-helper.ts](../../tests/ui/helpers/auth-helper.ts) ALWAYS goes through `profile.auth.loginPathPattern` first (e.g. `/auth/login?token=...`), which forces backend token validation, then waits for the post-login redirect. Detection of "Session Expired" runs in parallel with the dashboard-ready signal so a bad token surfaces a useful error message immediately.

### 5. Chat widgets steal clicks

**Symptom:** `button.click()` lands on a fixed-position chat iframe instead.

**Defense:** [reduceClickInterference](../../tests/ui/helpers/reliable-action.ts) — applied once per page in the auth fixture. Sets `pointer-events: none` on Zoho SalesIQ / Intercom / Drift selectors. Doesn't remove the widget (would break the app's JS); just disables its pointer capture.

### 6. Below-the-fold lazy renders report invisible

**Symptom:** assert visible on a pricing card → fails because `IntersectionObserver` hasn't fired.

**Defense:** [revealBelowFold](../../tests/ui/helpers/reliable-action.ts) — one `window.scrollTo(0, bottom)` mounts everything. Call before asserting visibility on anything past the first viewport.

### 7. React auto-IDs (`:r3d:`)

**Symptom:** copy a Playwright codegen recording, locator like `#:r7e:` works once and never again.

**Defense:** never hardcode auto-IDs. The profile's `selectorHints` and POM `getByRole/getByText/getByLabel` chains use semantic anchors (regexes, accessible names, label text). Codegen recordings are starting points, not finished tests.

### 8. Async backend state vs synchronous test

**Symptom:** test deactivates a product, asserts status changed; next test runs immediately and sees old status because the backend hasn't caught up.

**Defense:** the **suite-end verification registry** in [test-sku-config.ts](../../tests/ui/config/test-sku-config.ts). Action-trigger tests `queueVerification({ sku, expectedStatusPattern })`. A final test drains the queue and polls — gives async backend work time to complete.

### 9. `force: true` clicks hide real bugs

**Symptom:** test passes with `click({ force: true })`. Manual user clicks the button → nothing happens because an overlay covers it.

**Defense:** banned suite-wide. Use [reliableClick](../../tests/ui/helpers/reliable-action.ts) instead — it does scroll → visible → enabled → click, all real. If something's blocking the click, the test SHOULD fail.

### 10. `npm run test:ui --grep "x"` does nothing

**Symptom:** `--grep` silently ignored.

**Defense:** docs + README — pass through with `--`. Correct: `npm run test:ui -- --grep "x"`. The first `--` is npm-script literal; the second `grep` arg goes to playwright.

## Profile authoring tips

- **Labels are regex, not strings.** `/^active$/i` resists wording changes ("Active products" → still matches).
- **Use `.or()` chains** in POMs for selector fallbacks. The original POMs are full of `getByRole().or(getByText())` — mimic that.
- **`baseUrl` in profile** lets the QA skip exporting `APP_BASE_URL`. Set it once in the profile file.
- **Don't put credentials in the profile.** Profile is committed to git. Tokens go in `.env` (gitignored). Profile only references the env var NAME.
- **`panelPathPattern` regex** must capture group 1 = the panel base prefix. For apps without per-user panels, `^(https?:\/\/[^/]+)` matches just the origin.
- **Add a profile field only when ≥2 apps differ.** Resist god-objects. App-quirks live in POMs as before.

## Heal loop (when locators break against a new app)

1. Test fails with `[trySelectors] No candidate matched...`.
2. Check `reports/healing/<testId>-<ts>/` — DOM, screenshot, summary.
3. `npm run propose-heal-updates` — emits a diff against your active profile.
4. Review by hand. Apply only what's correct. Never auto-apply (false-greens).
5. Rerun.

## Sync (porting QA-automation improvements upstream)

```bash
export QA_AUTOMATION_PATH=/home/yash/QA-automation
npm run port-from-source
```

Verbatim files (helpers, skills) auto-port with `[y/N]`. POMs and fixtures get diff-only output — translate hardcoded strings → `profile.*` by hand.

Frequency: every 4-6 weeks calendar reminder, or after a meaningful improvement in QA-automation.

## Adding a third app, fourth app, …

Same as onboarding: `npm run adapt-app` per app. Each app gets its own profile + own SKU config. Active profile chosen by env var. Profiles for retired apps don't have to be removed; they just sit unused.

## What this skill is NOT

- **Not auto-test-generation.** The agent adapts existing tests; it never invents tests.
- **Not auto-healing.** Heals are human-reviewed diffs, never applied automatically.
- **Not domain-agnostic.** Seller/ecomm only — products, orders, returns, dashboard. Marketing sites and mobile-web are out of scope.
- **Not a CI tool.** Adaptation is one-shot onboarding. Heal-proposal is on-demand. Tests themselves run in CI; the agent doesn't.
