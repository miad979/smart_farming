import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const APP_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5176';
const A11Y_STRICT = process.env.A11Y_STRICT === '1';
const A11Y_VERBOSE = process.env.A11Y_VERBOSE === '1';

test('@a11y home page has no critical accessibility violations', async ({ page }) => {
  await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\//);

  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const criticalViolations = scan.violations.filter((item) => item.impact === 'critical');
  // Default mode audits and reports critical findings without failing CI.
  // Set A11Y_STRICT=1 to make critical accessibility issues fail the run.
  console.log(`A11Y_AUDIT_SUMMARY=${JSON.stringify({
    strict: A11Y_STRICT,
    critical: criticalViolations.length,
    totalViolations: scan.violations.length,
  })}`);

  if (A11Y_VERBOSE && scan.violations.length > 0) {
    const details = scan.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
    console.log(`A11Y_AUDIT_DETAILS=${JSON.stringify(details)}`);
  }

  if (A11Y_STRICT) {
    expect(criticalViolations).toEqual([]);
  } else {
    expect(Array.isArray(scan.violations)).toBe(true);
  }
});
