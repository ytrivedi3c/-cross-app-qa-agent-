# Reference — paths and troubleshooting

## Layout

```
mcp-app-tester/
├── playwright.config.ts          # webServer, viewport, timeouts
├── src/app-urls.ts               # localhost base, JWT panel id
├── src/seller-token.ts           # decode JWT → panel user id
├── tests/ui/
│   ├── dashboard-ui.spec.ts
│   ├── dashboard-refresh.spec.ts
│   ├── dashboard-codegen-flow.spec.ts
│   ├── my-flow.spec.ts
│   └── helpers/
│       ├── dashboard-auth.ts
│       ├── dashboard-locators.ts
│       ├── reliable-action.ts
│       └── dashboard-metrics.ts
├── tests/dashboard-test-cases.md
└── automation-workspace/company-app/frontend/
    └── src/Components/Dashboard/DashboardHeader.tsx  # Refresh id
```

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| `ERR_CONNECTION_REFUSED` | Webpack not running — start dev server or remove `PW_SKIP_WEB_SERVER` so Playwright starts it. |
| Session Expired | Opened `/panel/.../dashboard` without login URL, or `PANEL_USER_ID` ≠ JWT `user_id`. |
| Polls forever for “Total Products” | Wrong copy — use **Product Status** / `dashboardMainReady`. |
| `Target page closed` | Test timeout while still in `beforeAll` / auth — raise `test.setTimeout`. |
| Click does nothing | Overlay (chat), wrong locator, or button `disabled` / loading. |

## Exporting Cursor chat (manual)

Cursor stores conversation data under the user profile, not inside the repo. To keep a copy:

1. Use **Cursor → Export** / copy messages from the chat panel if available in your version.
2. Project-scoped **agent transcripts** may exist under  
   `~/.cursor/projects/<project-hash>/agent-transcripts/*.jsonl`  
   Copy those files to `docs/` if you need a raw archive.
3. This repo includes **`docs/session-handoff.md`** as a human-readable summary of the work done in this project.
