#!/usr/bin/env tsx
/**
 * port-from-source — sync improvements from QA-automation/mcp-testing into
 * this agent's matching files. Verbatim files (helpers, skills) auto-port
 * with [y/N] prompts. Generalized files (POMs, fixtures) are diff-only —
 * receiving QA decides how to translate hardcoded strings → profile.* refs.
 *
 * Run:
 *   export QA_AUTOMATION_PATH=/path/to/QA-automation
 *   npm run port-from-source
 *
 * ─── STATUS: SKELETON ─────────────────────────────────────────────────────
 *
 * Validates that QA_AUTOMATION_PATH points at a real folder and lists which
 * files differ. Full diff + port flow is the next iteration.
 */

import { promises as fs } from "fs";
import path from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

interface PortPair {
  category: "verbatim" | "generalized" | "skipped";
  src: string; // relative to QA_AUTOMATION_PATH
  dst: string; // relative to agent root
  reason?: string;
}

const PORT_PAIRS: PortPair[] = [
  // Verbatim category — auto-port-able with [y/N]
  {
    category: "verbatim",
    src: "mcp-testing/tests/ui/helpers/reliable-action.ts",
    dst: "tests/ui/helpers/reliable-action.ts",
  },
  {
    category: "verbatim",
    src: "mcp-testing/tests/ui/helpers/test-reporter.ts",
    dst: "tests/ui/helpers/test-reporter.ts",
  },
  // Skills are entire directories; would need recursive sync.
  // Generalized category — diff only, manual port (POMs use profile.*)
  {
    category: "generalized",
    src: "mcp-testing/tests/ui/pages/base.page.ts",
    dst: "tests/ui/pages/base.page.ts",
    reason: "Constructor reads profile; do not auto-overwrite.",
  },
  {
    category: "generalized",
    src: "mcp-testing/tests/ui/pages/products/products-list.page.ts",
    dst: "tests/ui/pages/products/products-list.page.ts",
    reason: "Hardcoded strings replaced by profile.* references.",
  },
  // Skipped — never sync
  {
    category: "skipped",
    src: "mcp-testing/playwright.config.ts",
    dst: "playwright.config.ts",
    reason: "Config differs intentionally (no webpack server in agent).",
  },
];

async function main(): Promise<void> {
  const qaPath = process.env.QA_AUTOMATION_PATH?.trim();
  if (!qaPath) {
    console.error("[port-from-source] QA_AUTOMATION_PATH env var is not set.");
    console.error("  Example: export QA_AUTOMATION_PATH=/home/you/QA-automation");
    process.exit(1);
  }

  try {
    const stat = await fs.stat(qaPath);
    if (!stat.isDirectory()) throw new Error("not a directory");
  } catch {
    console.error(`[port-from-source] QA_AUTOMATION_PATH does not exist or isn't a folder: ${qaPath}`);
    process.exit(1);
  }

  console.log(`\n[port-from-source] Source: ${qaPath}`);
  console.log("[port-from-source] Checking each tracked file pair...\n");

  const reportLines: string[] = [];
  let verbatimChanged = 0;
  let generalizedChanged = 0;

  for (const pair of PORT_PAIRS) {
    const srcAbs = path.join(qaPath, pair.src);
    const dstAbs = path.resolve(pair.dst);

    let srcContent = "";
    let dstContent = "";
    try {
      srcContent = await fs.readFile(srcAbs, "utf8");
    } catch {
      reportLines.push(`  [${pair.category}] MISSING-SRC ${pair.src}`);
      continue;
    }
    try {
      dstContent = await fs.readFile(dstAbs, "utf8");
    } catch {
      reportLines.push(`  [${pair.category}] MISSING-DST ${pair.dst}`);
      continue;
    }

    if (srcContent === dstContent) {
      reportLines.push(`  [${pair.category}] same       ${pair.dst}`);
    } else {
      reportLines.push(`  [${pair.category}] CHANGED    ${pair.dst}${pair.reason ? `  (${pair.reason})` : ""}`);
      if (pair.category === "verbatim") verbatimChanged++;
      if (pair.category === "generalized") generalizedChanged++;
    }
  }

  for (const l of reportLines) console.log(l);
  console.log(`\nSummary: ${verbatimChanged} verbatim files differ; ${generalizedChanged} generalized files differ.\n`);

  if (verbatimChanged === 0) {
    console.log("[port-from-source] Nothing auto-portable to do. ✓\n");
    return;
  }

  const rl = createInterface({ input, output });
  const ans = (await rl.question("Auto-port verbatim files now? [y/N]: ")).trim();
  rl.close();

  if (!/^y(es)?$/i.test(ans)) {
    console.log("[port-from-source] Skipped. No changes made.\n");
    return;
  }

  for (const pair of PORT_PAIRS) {
    if (pair.category !== "verbatim") continue;
    const srcAbs = path.join(qaPath, pair.src);
    const dstAbs = path.resolve(pair.dst);
    try {
      const c = await fs.readFile(srcAbs, "utf8");
      await fs.writeFile(dstAbs, c, "utf8");
      console.log(`  ✓ ported ${pair.dst}`);
    } catch (err) {
      console.log(`  × failed ${pair.dst}: ${(err as Error).message}`);
    }
  }

  console.log("\n[port-from-source] Done.");
  console.log("[port-from-source] Generalized files (POMs, fixtures) need MANUAL port.");
  console.log("[port-from-source] See diffs above and translate hardcoded strings → profile.* references.\n");
}

main().catch((err) => {
  console.error("[port-from-source] Failed:", err);
  process.exit(1);
});
