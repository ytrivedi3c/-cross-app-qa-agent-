---
name: section-scoped-regex-assertions
description: Scope text assertions to a single section of a multi-section page using regex lookahead — prevents collisions where the same word appears twice with different meanings (e.g. "Failed" in both Product Status and Order Status sections). Use when validating counts or labels on dashboards, summary pages, or any view with multiple same-shaped sections, or when the user mentions regex, innerText scraping, section scoping, or colliding labels.
author: Yash Trivedi
---

# section-scoped-regex-assertions

## Problem

On a dashboard like this:

```
Product Status
  Live:      42
  Failed:    7     ← "Failed" appears here
  Pending:  11

Order Status
  Awaiting Shipment: 14
  Completed:         81
  Failed:            3     ← and also here
  Delivered:        102
```

A naive assertion:

```ts
const text = await page.locator("main").innerText();
const match = text.match(/Failed\s+(\d+)/);   // ← matches the FIRST "Failed" (7), not the one you meant
```

You wanted the order-status "Failed" count (3), you got the product-status count (7). Test passes or fails on the wrong value. Assertion is silently testing the wrong thing.

## The fix: regex lookahead to scope

Slice `mainText` to just the section you care about, then match within that slice:

```ts
const mainText = await page.locator("main").innerText();

const orderSectionMatch = mainText.match(
  /Order Status[\s\S]*?(?=Frequently Asked|Recent Activit|Pricing Info|$)/
);
const orderText = orderSectionMatch ? orderSectionMatch[0] : mainText;

const match = orderText.match(/Failed\s+(\d+)/);   // ← now scoped to Order Status only
```

### Anatomy of the regex

`/Order Status[\s\S]*?(?=Frequently Asked|Recent Activit|Pricing Info|$)/`

| Part | Meaning |
|---|---|
| `Order Status` | Section start marker — the heading text |
| `[\s\S]*?` | Any characters (including newlines), lazy — stops at the nearest next-section marker |
| `(?=...)` | **Lookahead** — matches position, doesn't consume. The slice ends *before* the next section. |
| `Frequently Asked\|Recent Activit\|Pricing Info` | All plausible next-section headings. Cover multiple so the regex still works if one is missing. |
| `\|$` | Fallback: end of text (if the target section is the last one) |

### Why lazy (`*?`) not greedy (`*`)

Greedy would match from "Order Status" all the way to the last next-section marker (or end of text). You'd scope way too wide and re-hit the collision. Lazy stops at the **first** next-section marker, which is what you want.

### Why `[\s\S]` not `.`

By default `.` doesn't match newlines. Dashboards have section content on multiple lines. `[\s\S]` matches everything including newlines — equivalent to `.` with the `s` (dotAll) flag.

## Worked example

From [dashboard-full.pom.spec.ts](../../tests/ui/pom-specs/dashboard-full.pom.spec.ts) (`TTS_DAS_09`):

```ts
const main = authenticatedPage.locator("main");
const mainText = await main.innerText({ timeout: 10_000 }).catch(() => "");

// Scope to Order Status — without this, "Failed" collides with Product Status
const orderSectionMatch = mainText.match(
  /Order Status[\s\S]*?(?=Frequently Asked|Recent Activit|Pricing Info|$)/
);
const orderText = orderSectionMatch ? orderSectionMatch[0] : mainText;

const orderStatuses = ["Awaiting Shipment", "Awaiting Collection", "Completed", "Cancelled", "Failed", "Delivered"];
for (const status of orderStatuses) {
  const match = orderText.match(new RegExp(status + "[\\s\\n]+(\\d+)", "i"));
  // ... assert on match[1]
}
```

## When to use this pattern vs DOM scoping

| Approach | When |
|---|---|
| `page.locator('[data-section="order-status"]').innerText()` | **Preferred** if the DOM has a testid or semantic wrapper |
| Regex lookahead on `main` text | Fallback when the DOM has no clean wrapper, only heading text as the visual separator |

If you own the frontend code, add `data-testid="order-status-section"` to the wrapper and scope via the locator. If you're QA-only and can't modify the app (see `qa-bug-report-discipline`), the regex trick is the cleanest alternative — no product-code changes.

## Porting the pattern

For any "scrape text, assert count" pattern:

1. Identify the section heading that scopes your assertion.
2. Identify the **next** section heading (or multiple plausible ones).
3. Build the regex:
   ```
   /<SECTION_HEADING>[\s\S]*?(?=<NEXT_HEADING_1>|<NEXT_HEADING_2>|$)/
   ```
4. Run the inner match against the slice, not the full text.

## Gotchas

- **Forgetting the `$` fallback** — if your target section is the last one on the page, no next-section marker exists. Always include `|$`.
- **Over-specific next-section list** — if you only list one next-section marker and a future redesign renames it, your regex silently scopes wider than intended. List 2-3 plausible markers.
- **Escaping in `new RegExp()`** — when building a regex from a string, `\s` inside a double-quoted string is `\\s`. Easy to miss.
- **Unicode whitespace** — some apps use non-breaking spaces (` `) between label and count. `\s` matches these in ES2018+; verify your Node version. If in doubt, use `[\s \n]+`.
- **Case sensitivity** — add the `i` flag (`new RegExp(status + "...", "i")`) unless the exact casing is the assertion itself.
