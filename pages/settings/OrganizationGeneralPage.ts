import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { waitForApiResponse } from '../../utils/network';
import type { OrganizationProfile } from '../../utils/testData';

/**
 * Settings → Organization → General: the organization's profile.
 * The page also has a "Danger zone → Delete account" button that wipes the whole organization.
 * This class deliberately has no locator for it, so no test can press it by accident.
 */
export class OrganizationGeneralPage {
  readonly navigation: SettingsNavigation;
  readonly organizationIdInput: Locator;
  readonly nameInput: Locator;
  readonly websiteInput: Locator;
  readonly phoneInput: Locator;
  readonly currencyButton: Locator;
  readonly typeButton: Locator;
  readonly saveButton: Locator;
  /** The searchable dropdowns. Their trigger buttons are 0 px wide (see openSearchableDropdown). */
  private readonly timezoneTrigger: Locator;
  private readonly countryTrigger: Locator;

  constructor(private readonly page: Page) {
    this.navigation = new SettingsNavigation(page);
    this.organizationIdInput = page.getByRole('textbox', { name: 'Organization ID' });
    this.nameInput = page.getByRole('textbox', { name: 'Organization name' });
    this.websiteInput = page.getByRole('textbox', { name: 'Website' });
    this.phoneInput = page.getByRole('textbox', { name: 'Phone number' });
    this.currencyButton = page.getByRole('button', { name: 'Currency' });
    this.typeButton = page.getByRole('button', { name: 'Organization type' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.timezoneTrigger = page.getByRole('button', { name: 'Select timezone' });
    this.countryTrigger = page.getByRole('button', { name: 'Select country' });
  }

  /** Go to this page through the sidebar and the Settings menu. */
  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Organization', 'General');
    await expect(this.page).toHaveURL('/settings/organization');
  }

  /** Open this page directly and wait until the organization's details have loaded. */
  async open(): Promise<void> {
    await this.page.goto('/settings/organization');
    await expect(this.nameInput).not.toHaveValue('');
  }

  /** The Timezone field, showing the selected value, e.g. "Kathmandu (UTC+5:45)". */
  timezoneField(): Locator {
    return this.fieldOf(this.timezoneTrigger);
  }

  /** The Country field, showing the selected value with its flag, e.g. "🇳🇵 Nepal". */
  countryField(): Locator {
    return this.fieldOf(this.countryTrigger);
  }

  /** Change every editable field to `profile`. */
  async fillProfile(profile: OrganizationProfile): Promise<void> {
    await this.nameInput.fill(profile.name);
    await this.websiteInput.fill(profile.website);
    await this.phoneInput.fill(profile.phoneDigits);
    await this.chooseFromSearchableDropdown(this.countryTrigger, profile.country.name);
    await this.chooseFromSearchableDropdown(this.timezoneTrigger, profile.timezone.label);
    await this.typeButton.click();
    await this.page.getByRole('option', { name: profile.type.label }).click();
  }

  /** Press Save and wait until the server has stored the changes. */
  async save(): Promise<void> {
    const saved = waitForApiResponse(this.page, 'PATCH', /^\/v1\/organizations\/[^/]+$/);
    await this.saveButton.click();
    expect((await saved).ok(), 'the server should accept the changes').toBe(true);
    // Save is enabled only while there are unsaved changes.
    await expect(this.saveButton).toBeDisabled();
  }

  /** Reload the page and check every editable field shows exactly `profile`. */
  async expectSavedProfile(profile: OrganizationProfile): Promise<void> {
    // Reloading proves the values came from the server, not from what is still in the form.
    await this.page.reload();
    await expect(this.nameInput).toHaveValue(profile.name);
    await expect(this.websiteInput).toHaveValue(profile.website);
    // The field formats the number as you type ("981-2345678"), so compare the digits.
    await expect
      .poll(async () => (await this.phoneInput.inputValue()).replace(/\D/g, ''))
      .toBe(profile.phoneDigits);
    await expect(this.countryField()).toContainText(profile.country.name); // after the flag
    await expect(this.timezoneField()).toHaveText(profile.timezone.label);
    await expect(this.typeButton).toHaveText(profile.type.label);
  }

  /**
   * Open a searchable dropdown (Country, Timezone), type to filter, and pick an option.
   * The trigger button is 0 px wide in the app, so it can't be clicked; focusing it and pressing
   * Enter is how a keyboard user opens it, and works the same.
   */
  private async chooseFromSearchableDropdown(trigger: Locator, optionName: string): Promise<void> {
    await trigger.press('Enter');
    // The dropdown opens with its search box focused; the first word is enough to filter.
    await this.page.keyboard.type(optionName.split(' ')[0]);
    // exact: "India" must not also match "British Indian Ocean Territory".
    await this.page.getByRole('option', { name: optionName, exact: true }).click();
  }

  /** The group that holds a dropdown's trigger; its text is the selected value. */
  private fieldOf(trigger: Locator): Locator {
    return this.page.getByRole('group').filter({ has: trigger });
  }
}
