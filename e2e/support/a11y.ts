import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Page = import('@playwright/test').Page;

export async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
