import { expect, type Locator, type Page } from '@playwright/test';
import { ClinicFormPage } from './ClinicFormPage';
import { ENDPOINTS } from '../../api/ResourceApi';
import type { TreatmentData } from '../../utils/testData';

/** Clinic → Treatments: the treatments list and the new/edit treatment form. */
export class TreatmentsPage extends ClinicFormPage<TreatmentData> {
  readonly priceInput: Locator;
  readonly discountedPriceInput: Locator;

  constructor(page: Page) {
    super(page, {
      listPath: '/treatments',
      menuLinkName: 'Treatments',
      addButtonName: 'Add treatment',
      createButtonName: 'Add treatment',
      rowActionsButtonName: 'Treatment actions',
      apiPath: ENDPOINTS.treatments,
    });
    // exact: "Price" would otherwise also match "Discounted price".
    this.priceInput = page.getByRole('spinbutton', { name: 'Price', exact: true });
    this.discountedPriceInput = page.getByRole('spinbutton', { name: 'Discounted price' });
  }

  protected override async fillExtraFields(treatment: TreatmentData): Promise<void> {
    await this.priceInput.fill(treatment.price);
    await this.discountedPriceInput.fill(treatment.discountedPrice);
  }

  protected override async expectExtraFields(treatment: TreatmentData): Promise<void> {
    await expect(this.priceInput).toHaveValue(treatment.price);
    await expect(this.discountedPriceInput).toHaveValue(treatment.discountedPrice);
  }
}
