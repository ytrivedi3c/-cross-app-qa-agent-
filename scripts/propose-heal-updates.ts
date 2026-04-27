#!/usr/bin/env tsx
/**
 * propose-heal-updates — reads reports/healing/heal-log.jsonl, groups by
 * failed locator field, and emits a proposed diff against the active
 * AppProfile. Never auto-applies. Human-in-the-loop only.
 *
 * Run: `npm run propose-heal-updates`
 *
 * ─── STATUS: SKELETON ─────────────────────────────────────────────────────
 *
 * Reads the heal log if it exists and prints a summary. Full LLM-backed
 * diff proposal is the next iteration.
 */

import { promises as fs } from "fs";
import path from "path";

interface HealLogEntry {
  timestamp: string;
  testId: string;
  description: string;
  url: string;
  attempts: Array<{ label: string; resolved: boolean; reason?: string }>;
  evidenceDir: string;
}

async function main(): Promise<void> {
  const logPath = path.resolve("reports", "healing", "heal-log.jsonl");
  let raw: string;
  try {
    raw = await fs.readFile(logPath, "utf8");
  } catch {
    console.log("\n[propose-heal-updates] No heal log found at reports/healing/heal-log.jsonl");
    console.log("[propose-heal-updates] (This means trySelectors() has never failed — that's good.)");
    return;
  }

  const lines = raw.split("\n").filter((l) => l.trim());
  const entries: HealLogEntry[] = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((e): e is HealLogEntry => e !== null);

  if (entries.length === 0) {
    console.log("\n[propose-heal-updates] heal-log.jsonl is empty.");
    return;
  }

  console.log(`\n[propose-heal-updates] Found ${entries.length} heal failures.\n`);
  console.log("Grouped by testId:");
  const byTestId = new Map<string, HealLogEntry[]>();
  for (const e of entries) {
    const list = byTestId.get(e.testId) ?? [];
    list.push(e);
    byTestId.set(e.testId, list);
  }
  for (const [testId, group] of byTestId) {
    console.log(`  ${testId}: ${group.length} failure(s)`);
    const latest = group[group.length - 1];
    console.log(`    last: ${latest.timestamp}`);
    console.log(`    evidence: ${latest.evidenceDir}`);
    console.log(`    attempts: ${latest.attempts.map((a) => `${a.label}=${a.reason ?? "ok"}`).join(", ")}`);
  }

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(" Next iteration: this script will call Claude API with each");
  console.log(" failed-test's DOM snapshot + the original profile field, and");
  console.log(" propose a unified diff against the active app-profile file.");
  console.log(" YOU REVIEW + APPLY BY HAND. Never auto-applied.");
  console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("[propose-heal-updates] Failed:", err);
  process.exit(1);
});
