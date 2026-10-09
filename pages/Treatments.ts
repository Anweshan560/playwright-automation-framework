
import { Page, Locator, expect } from '@playwright/test';

export class TreatmentsPage {
  readonly page: Page;
  readonly clinicLink: Locator;
  readonly treatmentsLink: Locator;
  readonly addTreatmentButton: Locator;
  readonly treatmentNameInput: Locator;
  readonly treatmentPriceInput: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.clinicLink = page.getByRole('link', { name: 'Clinic' });
    this.treatmentsLink = page.getByRole('link', { name: 'Treatments' });
    this.addTreatmentButton = page.getByRole('button', {
      name: 'Add Treatment'
    });
    this.treatmentNameInput = page.getByPlaceholder('Enter treatment name');
    this.treatmentPriceInput = page.getByPlaceholder('Starting price');
    this.createButton = page.getByRole('button', {
      name: 'Create and continue'
    });
  }

  async goToTreatments() {
    await this.clinicLink.click();
    await this.treatmentsLink.click();

    await expect(this.page).toHaveURL(
      'https://beta.replyn.dev/treatments'
    );
  }

  async createTreatment() {
    const treatmentName = `Treatment ${Date.now()}`;

    await this.addTreatmentButton.click();

    await this.treatmentNameInput.fill(treatmentName);
    await this.treatmentPriceInput.fill('1000');

    await this.createButton.click();

    await expect(
      this.page.getByText(treatmentName, { exact: true })
    ).toBeVisible();
  }
}

