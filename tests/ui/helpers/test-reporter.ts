/**
 * Copyright (c) 2026 Yash Trivedi. All rights reserved.
 * Author: Yash Trivedi <yash.trivedi@threecolts.com>
 * Created: April 2026
 *
 * This test suite is the intellectual property of Yash Trivedi.
 * Unauthorized modification or removal of this attribution is prohibited.
 */
import { test } from "@playwright/test";

export type ValidationStep = {
  step: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
};

/**
 * Collects validation steps during a test and attaches a structured report
 * to the Playwright HTML report — visible for both passing and failing tests.
 */
export class TestReporter {
  private steps: ValidationStep[] = [];
  private testCaseId: string;
  private testCaseName: string;
  private expectedResult: string;

  constructor(testCaseId: string, testCaseName: string, expectedResult: string) {
    this.testCaseId = testCaseId;
    this.testCaseName = testCaseName;
    this.expectedResult = expectedResult;
  }

  /** Log a validation step. */
  log(step: string, expected: string, actual: string, status: "PASS" | "FAIL" | "SKIP" | "WARN"): void {
    this.steps.push({ step, expected, actual, status });
  }

  /** Shorthand: log a passing step. */
  pass(step: string, expected: string, actual: string): void {
    this.log(step, expected, actual, "PASS");
  }

  /** Shorthand: log a failing step. */
  fail(step: string, expected: string, actual: string): void {
    this.log(step, expected, actual, "FAIL");
  }

  /**
   * Log a skipped step AND throw — preventing the "soft-pass" pattern where
   * a test reports SKIP but Playwright still reports it as green.
   *
   * Previously `r.skip()` only logged a SKIP status; tests continued and
   * ended up PASSing because there was no throw. That hid real issues (wrong
   * selector, missing product, wrong tab) behind fake-green test status.
   *
   * Now: calling r.skip() throws, so the test fails loudly with the reason
   * surfaced in the error. Each failure points to the setup/config problem
   * that the test actually needs to handle properly (typically: use a
   * dedicated SKU, assert hard-failure messages, or restructure the flow).
   *
   * If you genuinely cannot perform the verification and want the test to
   * FAIL LOUDLY with context (the correct behaviour per project rules), call
   * this. Do NOT expect tests to silently pass on missing prerequisites.
   */
  skip(step: string, reason: string): never {
    this.log(step, "N/A", reason, "SKIP");
    throw new Error(
      `[TestReporter.skip] ${step} — ${reason}\n` +
        `This test can no longer silently pass on missing prerequisites. ` +
        `Fix the test to either (a) use a specific SKU from test-sku-config so the ` +
        `prerequisite is guaranteed, or (b) hard-assert the condition with a clear ` +
        `actionable error message.`
    );
  }

  /** Shorthand: log a warning step. */
  warn(step: string, expected: string, actual: string): void {
    this.log(step, expected, actual, "WARN");
  }

  /**
   * Resolve PASS/FAIL from a boolean. Use this instead of hardcoded "PASS"
   * so the report reflects real results.
   *
   * Example:
   *   r.check("Bulk Upload button visible", "visible", await btn.isVisible());
   */
  check(step: string, expected: string, actual: boolean | string, pass?: boolean): void {
    const didPass = pass ?? (typeof actual === "boolean" ? actual : actual === expected);
    const actualStr = typeof actual === "boolean" ? String(actual) : actual;
    this.log(step, expected, actualStr, didPass ? "PASS" : "FAIL");
  }

  /** Build the markdown report string. */
  private buildReport(): string {
    const statusIcon = (s: string) =>
      s === "PASS" ? "✅" : s === "FAIL" ? "❌" : s === "SKIP" ? "⏭️" : "⚠️";

    const hasFail = this.steps.some((s) => s.status === "FAIL");
    const allSkip = this.steps.every((s) => s.status === "SKIP");
    const hasPass = this.steps.some((s) => s.status === "PASS");
    const hasWarn = this.steps.some((s) => s.status === "WARN");

    const overallStatus = hasFail
      ? "❌ FAILED"
      : allSkip
        ? "⏭️ SKIPPED"
        : !hasPass && hasWarn
          ? "⚠️ PASSED WITH WARNINGS (no real assertion met)"
          : hasWarn
            ? "⚠️ PASSED WITH WARNINGS"
            : "✅ PASSED";

    let md = `# ${this.testCaseId}: ${this.testCaseName}\n\n`;
    md += `**Overall Result:** ${overallStatus}\n\n`;
    md += `**Expected Result:** ${this.expectedResult}\n\n`;
    md += `---\n\n`;
    md += `## Validation Steps\n\n`;
    md += `| # | Step | Expected | Actual | Result |\n`;
    md += `|---|------|----------|--------|--------|\n`;

    this.steps.forEach((s, i) => {
      const icon = statusIcon(s.status);
      md += `| ${i + 1} | ${s.step} | ${s.expected} | ${s.actual} | ${icon} ${s.status} |\n`;
    });

    md += `\n---\n`;
    md += `*Validated at: ${new Date().toISOString()}*\n`;
    return md;
  }

  /**
   * Attach the validation report to the current Playwright test (visible in HTML report).
   *
   * Also enforces the suite-wide "no soft pass" rule: if the report contains
   * ANY WARN/SKIP statuses AND zero PASS statuses, throw. Without a single
   * successful assertion, a test that only logged WARNs is a soft-pass in
   * disguise — Playwright would otherwise report it green.
   *
   * This is the companion safety net to `skip()` throwing: `skip()` catches
   * early-return skips, this catches tests that ran to completion with only
   * diagnostic WARNs recorded. Together they guarantee no silent-green tests.
   */
  async attach(): Promise<void> {
    const report = this.buildReport();
    await test.info().attach(`${this.testCaseId} — Validation Report`, {
      body: report,
      contentType: "text/markdown",
    });

    const hasPass = this.steps.some((s) => s.status === "PASS");
    const warnSteps = this.steps.filter((s) => s.status === "WARN");
    const skipSteps = this.steps.filter((s) => s.status === "SKIP");
    if (!hasPass && (warnSteps.length > 0 || skipSteps.length > 0)) {
      const reasons = [...warnSteps, ...skipSteps]
        .map((s) => `  - ${s.status}: ${s.step} — actual: ${s.actual}`)
        .join("\n");
      throw new Error(
        `[TestReporter.attach] ${this.testCaseId} has no PASS steps but ${warnSteps.length} WARN and ${skipSteps.length} SKIP steps. ` +
          `A test that records only WARN/SKIP has not actually verified anything — this is a soft-pass in disguise.\n` +
          `Recorded steps:\n${reasons}\n` +
          `Fix: add a real hard assertion that logs PASS, or convert WARN steps to FAIL with expect() calls.`
      );
    }
  }
}
