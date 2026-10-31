import type { Page } from '@playwright/test';

/**
 * The setup guide floats over the bottom right of every page, where lower rows' buttons are.
 * Collapse it right before clicking such a button: it can appear a moment after the page loads.
 */
export async function collapseSetupGuide(page: Page): Promise<void> {
  const collapse = page.getByRole('button', { name: 'Collapse setup guide' });
  if (await collapse.isVisible()) await collapse.click();
}
