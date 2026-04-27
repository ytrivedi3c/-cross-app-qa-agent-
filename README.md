# cross-app-qa-agent

A Playwright UI test suite designed to be **adapted to any seller/ecomm dashboard** by swapping a single configuration file. Built for QAs across the company who want the same test coverage and quality patterns the original suite has, on their own app, in under an hour.

If your app has products, orders, returns, and a dashboard — this agent has tests for it. The hard parts (locator stability under list re-sorts, real-vs-React-state verification, async backend assertions, chat-widget click interference) are already solved.

## Quick start

```bash
git clone <agent-repo-url> my-qa-workspace
cd my-qa-workspace

# 1. Install deps
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set your auth token + ANTHROPIC_API_KEY (only needed for adaptation agent)

# 3. Onboard your app — interactive wizard
npm run adapt-app
# → asks for URL, auth method, feature routes
# → writes tests/ui/config/app-profiles/<your-slug>.ts
# → writes tests/ui/config/test-sku-config.<your-slug>.ts

# 4. Set the active profile
echo "APP_PROFILE=<your-slug>" >> .env

# 5. Run smoke tests — proves your config works end-to-end
npm run test:ui -- --grep SMOKE

# 6. View the Allure report
npm run allure:serve
```

If steps 5-6 pass, you're operational. Fill sandbox SKUs in `tests/ui/config/test-sku-config.<slug>.ts` and run the broader suite.

## What's in this repo

```
cross-app-qa-agent/
├── tests/ui/
│   ├── config/
│   │   ├── app-profile.ts              # The AppProfile interface
│   │   ├── app-profiles/               # One file per app — yours lives here
│   │   │   ├── example.ts              # Reference profile
│   │   │   └── tiktok-shop.ts          # Real-world example
│   │   └── test-sku-config.ts          # Empty template; fill per app
│   ├── pages/                          # POMs — read profile, not hardcoded strings
│   ├── pom-specs/                      # Test files
│   │   └── smoke.pom.spec.ts           # Run these first; baseline reachability
│   ├── helpers/
│   │   ├── reliable-action.ts          # reduceClickInterference / reliableClick / revealBelowFold
│   │   ├── test-reporter.ts            # Per-step PASS/FAIL validation rows
│   │   ├── auth-helper.ts              # Profile-driven login dispatcher
│   │   └── healing-locator.ts          # trySelectors — no silent heals
│   └── fixtures/auth.fixture.ts        # Worker-scoped auth (one login per run)
├── scripts/
│   ├── adapt-app.ts                    # Wizard
│   ├── adapt-app-agent.ts              # LLM-based label/selector refinement (skeleton)
│   ├── propose-heal-updates.ts         # Reads heal log, proposes profile diffs
│   └── port-from-source.ts             # Sync from upstream QA-automation
└── .cursor/skills/
    └── cross-app-profile-adapter/      # Read this for the full pattern
```

## npm scripts

| Command | Purpose |
|---|---|
| `npm run adapt-app` | Interactive wizard — onboard a new app |
| `npm run test:ui` | Run all tests against the active profile |
| `npm run test:ui:headed` | Same, with a visible browser |
| `npm run test:ui:report` | Open the Playwright HTML report |
| `npm run propose-heal-updates` | Read heal log, propose profile diffs (human-reviewed) |
| `npm run port-from-source` | Sync improvements from upstream QA-automation |
| `npm run adapt-app-agent` | Refine label/selector hints from your live app (skeleton) |

## Known issues & solutions

These are flake sources the original test suite paid for in hours of debugging. Each has a defense baked into this agent — **don't disable them** thinking you're cleaning up.

### "First row" tests fail intermittently

**Why:** every seller/ecomm list re-sorts after edits — the row at index 0 is a different product on every run.

**Fix:** use `productsPage.searchAndOpenBySku(sku)` for stateful tests. Centralise SKUs in `test-sku-config.<slug>.ts`. See the `sku-anchored-test-targeting` skill.

### Test passes but data didn't actually save

**Why:** React still has the new value in memory. Reload the page → backend has the old value.

**Fix:** save-reload-restore pattern — after Save, `page.goto(editUrl)` to clear React state, then assert the value persists, then restore. Hard signal for save success: the **Save button transitioning enabled→disabled**, not toast detection.

### "Session Expired" right after login

**Why:** navigating directly to `/panel/<id>/dashboard` with a JWT in env. The API rejects unverified tokens.

**Fix:** the auth helper ALWAYS hits `profile.auth.loginPathPattern` first (e.g. `/auth/login?token=…`). If the token is rejected, you'll see a clear "Session Expired" error pointing at your env var name. Get a fresh token and retry.

### Buttons "not clickable" / chat widget overlay

**Why:** Zoho SalesIQ / Intercom / Drift inject a fixed-position iframe that intercepts clicks.

**Fix:** the auth fixture calls `reduceClickInterference(page)` once after login. Sets `pointer-events: none` on widget selectors. Don't remove this call.

### Below-the-fold elements report invisible

**Why:** lazy-rendered via `IntersectionObserver`; not mounted until scrolled to.

**Fix:** call `revealBelowFold(page)` before asserting visibility on anything past the first viewport.

### `--grep` does nothing when run via npm

**Why:** `npm run test:ui --grep X` consumes `--grep` itself. The double-dash is load-bearing.

**Fix:** `npm run test:ui -- --grep "X"` (the `--` separates npm args from script args).

### Allure report doesn't include my screenshots

**Why:** screenshot-on-failure is configured in `playwright.config.ts use:` but Allure attaches them only when their step fails. Successful tests have no screenshots by default.

**Fix:** for guaranteed screenshots, use `await testInfo.attach('name', { body: await page.screenshot() })` from inside the test. Or set `screenshot: 'only-on-failure'` to `'on'` in `playwright.config.ts` (caution: gets large fast).

## Auth methods supported

| Method | When | What you set |
|---|---|---|
| `jwt-query-param` | App accepts JWT in URL query string. **Recommended** when available. | `tokenEnvVar` in profile + that env var in `.env` |
| `form-login` | Plain HTML username/password form | `APP_USERNAME` + `APP_PASSWORD` in `.env` |
| `oauth-manual` | External IdP redirect | Run headed; complete login by hand; suite resumes when dashboard loads |

## Adding sandbox SKUs

Tests that mutate state (deactivate, delete, edit-and-restore) target dedicated sandbox products by id. Open `tests/ui/config/test-sku-config.<slug>.ts` and fill the slots:

| Slot | What kind of product |
|---|---|
| `saveFlowLive` | Live product with rich schema (attributes, variations) — non-destructive edit |
| `deactivateModal` | Live product — modal cancel only, not really deactivated |
| `deactivateSuccess` | Live product OK to deactivate + reactivate |
| `deleteModal` | Any product — modal cancel only |
| `deleteSuccess` | Throwaway product — will be permanently deleted |
| `syncTarget` | Live product — async actions verified at suite end |

Empty slots fail tests **loudly** with a clear message. We never silently fall back to "first row" — that's the exact flakiness this exists to prevent.

## Versioning + getting updates

This agent is versioned via `package.json` + git tags. To get fixes:

```bash
git pull origin main
npm install                    # picks up dep changes if any
# Your app-profiles/<slug>.ts and test-sku-config.<slug>.ts are PRESERVED
# because they're per-app files. Only shared code updates.
```

If a new field appears in the `AppProfile` interface, you may need to add it to your profile (TypeScript will tell you).

## Where to learn more

The `cross-app-profile-adapter` skill at [.cursor/skills/cross-app-profile-adapter/SKILL.md](.cursor/skills/cross-app-profile-adapter/SKILL.md) is the full deep-dive: architecture, profile authoring tips, every gotcha and its defense, the heal loop, the sync flow.

## Need help?

Check the heal log first: `reports/healing/heal-log.jsonl`. Most "test failed" reports trace back to a label/selector mismatch already captured there with full DOM evidence.

Then run `npm run propose-heal-updates` for an LLM-suggested profile diff (human-reviewed, never auto-applied).

Still stuck? Open an issue with: your profile file, the failing test name, and the heal log entry.
