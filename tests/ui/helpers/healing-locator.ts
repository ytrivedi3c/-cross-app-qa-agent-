import type { Page, Locator } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

/**
 * trySelectors — try each candidate locator in order; return the first that
 * resolves to a visible element. On exhaustion: capture a DOM snapshot and
 * screenshot to reports/healing/, append one line to heal-log.jsonl, and
 * throw clearly.
 *
 * ─── WHY THIS EXISTS, AND WHAT IT WILL NEVER DO ──────────────────────────
 *
 * Auto-healing locators (Testim, Mabl, etc.) are seductive: when a selector
 * breaks, they "find a similar element" and let the test pass. This creates
 * silent false-greens — the test passes against the WRONG element, masking
 * real regressions for weeks.
 *
 * This helper is INTENTIONALLY a "trier", not a healer. It:
 *   1. Tries multiple known-good candidates in priority order.
 *   2. RETURNS the first one that resolves — that's the "trying" half.
 *   3. On failure, LOGS evidence (DOM + screenshot + which candidates failed)
 *      and THROWS. It does not silently substitute or guess.
 *
 * The "healing" half is a separate, human-in-the-loop process: run
 * `npm run propose-heal-updates`, review the LLM's diff against your active
 * profile, and apply by hand.
 */

export interface HealCandidate {
  /** Human-readable label for the diagnostic — e.g. "by-role-active". */
  label: string;
  /** Playwright locator. */
  locator: Locator;
}

export async function trySelectors(
  page: Page,
  testId: string,
  candidates: HealCandidate[],
  options: { timeout?: number; description?: string } = {}
): Promise<Locator> {
  const timeout = options.timeout ?? 10_000;
  const attempts: Array<{ label: string; resolved: boolean; reason?: string }> = [];

  for (const c of candidates) {
    try {
      const count = await c.locator.count();
      if (count === 0) {
        attempts.push({ label: c.label, resolved: false, reason: "count=0" });
        continue;
      }
      const visible = await c.locator
        .first()
        .isVisible({ timeout: Math.min(timeout, 3_000) })
        .catch(() => false);
      if (!visible) {
        attempts.push({ label: c.label, resolved: false, reason: "not-visible" });
        continue;
      }
      // Winner.
      attempts.push({ label: c.label, resolved: true });
      return c.locator;
    } catch (err) {
      attempts.push({
        label: c.label,
        resolved: false,
        reason: (err as Error).message?.slice(0, 200) ?? "throw",
      });
    }
  }

  // No candidate matched. Capture evidence + log + throw.
  const evidence = await captureHealEvidence(page, testId, candidates, attempts);
  await appendHealLog(testId, options.description ?? "(unspecified)", attempts, evidence);

  throw new Error(
    `[trySelectors] No candidate matched for testId="${testId}". ` +
      `Tried ${candidates.length}: ${attempts.map((a) => `${a.label}=${a.reason}`).join(", ")}. ` +
      `Evidence saved to ${evidence.dir}. ` +
      `Run 'npm run propose-heal-updates' to get a profile diff suggestion (human-reviewed; not auto-applied).`
  );
}

interface HealEvidence {
  dir: string;
  domSnapshotPath: string;
  screenshotPath: string;
  url: string;
}

async function captureHealEvidence(
  page: Page,
  testId: string,
  candidates: HealCandidate[],
  attempts: Array<{ label: string; resolved: boolean; reason?: string }>
): Promise<HealEvidence> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve("reports", "healing", `${testId}-${ts}`);
  await fs.mkdir(dir, { recursive: true });

  const domSnapshotPath = path.join(dir, "dom.html");
  const screenshotPath = path.join(dir, "screenshot.png");
  const summaryPath = path.join(dir, "summary.json");

  const html = await page.content().catch(() => "<!-- could not capture DOM -->");
  await fs.writeFile(domSnapshotPath, html, "utf8");
  await page
    .screenshot({ path: screenshotPath, fullPage: true })
    .catch(() => {});

  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        testId,
        url: page.url(),
        timestamp: ts,
        candidates: candidates.map((c) => c.label),
        attempts,
      },
      null,
      2
    ),
    "utf8"
  );

  return { dir, domSnapshotPath, screenshotPath, url: page.url() };
}

async function appendHealLog(
  testId: string,
  description: string,
  attempts: Array<{ label: string; resolved: boolean; reason?: string }>,
  evidence: HealEvidence
): Promise<void> {
  const logDir = path.resolve("reports", "healing");
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, "heal-log.jsonl");

  const entry = {
    timestamp: new Date().toISOString(),
    testId,
    description,
    url: evidence.url,
    attempts,
    evidenceDir: evidence.dir,
  };

  await fs.appendFile(logPath, JSON.stringify(entry) + "\n", "utf8");
}
