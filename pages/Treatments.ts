
import { Page, Locator } from '@playwright/test';

export class TreatmentsPage {
  readonly page: Page;
  readonly clinicLink: Locator;
  readonly treatmentsLink: Locator;
  readonly addTreatmentButton: Locator;
  readonly treatmentNameInput: Locator;
  readonly treatmentPriceInput: Locator;
  readonly createButton: Locator;
  readonly deleteDialog: Locator;

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
      name: 'Add treatment'
    });
    this.deleteDialog = page.getByRole('dialog', { name: 'Delete treatment?' });
  }

  async goToTreatments() {
    await this.clinicLink.click();
    await this.treatmentsLink.click();
  }

  /** Create a treatment with a unique name and return that name. */
  async createTreatment(price = '1000'): Promise<string> {
    const treatmentName = `Treatment ${Date.now()}`;

    await this.addTreatmentButton.click();

    await this.treatmentNameInput.fill(treatmentName);
    await this.treatmentPriceInput.fill(price);

    // The app's floating setup-guide button sits on top of "Add treatment",
    // so a mouse click is blocked; pressing it with the keyboard avoids the overlay.
    await this.createButton.press('Enter');

    return treatmentName;
  }

  row(treatmentName: string): Locator {
    return this.page.getByRole('row', { name: treatmentName });
  }

  async openTreatmentsList() {
    await this.page.goto('/treatments');
  }

  async deleteTreatment(treatmentName: string) {
    await this.openTreatmentsList();
    await this.row(treatmentName)
      .getByRole('button', { name: 'Treatment actions' })
      .first()
      .click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.deleteDialog.getByRole('button', { name: 'Delete' }).click();
  }
}
