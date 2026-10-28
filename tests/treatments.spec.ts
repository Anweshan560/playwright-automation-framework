import { test, expect } from '@playwright/test';
import { TreatmentsPage } from '../pages/Treatments';

// Already logged in through the saved session from tests/auth.setup.ts.
test('user can create a treatment', async ({ page }) => {
  const treatmentsPage = new TreatmentsPage(page);

  await page.goto('/dashboard');
  await treatmentsPage.goToTreatments();
  await expect(page).toHaveURL('/treatments');

  const treatmentName = await treatmentsPage.createTreatment();

  try {
    await treatmentsPage.openTreatmentsList();
    await expect(treatmentsPage.row(treatmentName)).toBeVisible();
  } finally {
    // Delete the treatment even if the check above failed, so beta doesn't fill up with test data.
    await treatmentsPage.deleteTreatment(treatmentName);
    await expect(treatmentsPage.row(treatmentName)).toHaveCount(0);
  }
});
