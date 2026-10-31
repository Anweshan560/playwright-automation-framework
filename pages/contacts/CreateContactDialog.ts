import { expect, type Locator, type Page } from '@playwright/test';
import { ENDPOINTS } from '../../api/ResourceApi';
import type { Contact } from '../../api/ContactsApi';
import { waitForApiResponse } from '../../utils/network';
import type { ContactData } from '../../utils/testData';

/** Everything the Create contact dialog can be filled with. Only the first name is required. */
export type NewContact = Partial<ContactData> & {
  firstName: string;
  /** A stage name, e.g. "Hot Lead". */
  lifecycle?: string;
  origin?: 'Manual' | 'Referral' | 'EMR';
  /** Needed when the origin is Referral. */
  referredBy?: string;
  /** Tag names. */
  tags?: string[];
};

/** The app posts new contacts to "/v1/contacts/", with a trailing slash. */
const CREATE_PATH = new RegExp(`^${ENDPOINTS.contacts}/?$`);

/** Contacts → Add Contact. */
export class CreateContactDialog {
  readonly root: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;
  readonly addressInput: Locator;
  readonly referredByInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly invalidEmailError: Locator;
  readonly invalidPhoneError: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Create contact' });
    this.firstNameInput = this.root.getByRole('textbox', { name: 'First name' });
    this.lastNameInput = this.root.getByRole('textbox', { name: 'Last name' });
    this.phoneInput = this.root.getByRole('textbox', { name: 'Phone' });
    this.emailInput = this.root.getByRole('textbox', { name: 'Email' });
    this.addressInput = this.root.getByRole('textbox', { name: 'Address' });
    this.referredByInput = this.root.getByRole('textbox', { name: 'Referred by' });
    this.createButton = this.root.getByRole('button', { name: 'Create contact' });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' });
    this.closeButton = this.root.getByRole('button', { name: 'Close' });
    this.invalidEmailError = this.root.getByText('Enter a valid email');
    this.invalidPhoneError = this.root.getByText('Enter a valid phone number');
  }

  /** Press Add Contact and wait for the empty dialog. */
  async open(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(this.root).toBeVisible();
  }

  /** Fill every field given in `contact`; fields left out keep their current value. */
  async fill(contact: Partial<NewContact>): Promise<void> {
    if (contact.firstName !== undefined) await this.firstNameInput.fill(contact.firstName);
    if (contact.lastName !== undefined) await this.lastNameInput.fill(contact.lastName);
    if (contact.phone !== undefined) {
      // The phone field formats the number as it is typed, so type it key by key like a user.
      await this.phoneInput.clear();
      await this.phoneInput.pressSequentially(contact.phone);
    }
    if (contact.email !== undefined) await this.emailInput.fill(contact.email);
    if (contact.address !== undefined) await this.addressInput.fill(contact.address);
    if (contact.lifecycle) await this.chooseLifecycle(contact.lifecycle);
    if (contact.origin) await this.chooseOrigin(contact.origin);
    if (contact.referredBy !== undefined) await this.referredByInput.fill(contact.referredBy);
    for (const tag of contact.tags ?? []) await this.addTag(tag);
  }

  /**
   * Press Create contact and wait for the server. Does not wait for the dialog to close, so the
   * caller can register cleanup first; check `root` is hidden afterwards.
   * @returns the new contact, as the server stored it.
   */
  async submit(): Promise<Contact> {
    const created = waitForApiResponse(this.page, 'POST', CREATE_PATH);
    await this.createButton.click();
    const response = await created;
    expect(response.status(), 'the server should create the contact').toBe(201);
    return (await response.json()).data;
  }

  /** Move focus out of the field just typed in, which is when the dialog checks it. */
  async leaveField(): Promise<void> {
    await this.addressInput.click();
  }

  private async chooseLifecycle(stage: string): Promise<void> {
    // The dropdown's own button is zero-sized; its box (a group) is what takes the click.
    await this.dropdown('Select lifecycle').click();
    await this.page
      .getByRole('dialog', { name: 'Select lifecycle' })
      .getByRole('option', { name: stage })
      .click();
    await expect(this.dropdown('Select lifecycle')).toContainText(stage);
  }

  private async chooseOrigin(origin: NonNullable<NewContact['origin']>): Promise<void> {
    await this.root.getByRole('button', { name: /Origin$/ }).click();
    await this.page
      .getByRole('listbox', { name: 'Origin' })
      .getByRole('option', { name: origin, exact: true })
      .click();
    await expect(this.root.getByRole('button', { name: /Origin$/ })).toHaveText(origin);
  }

  private async addTag(tag: string): Promise<void> {
    await this.dropdown('Select tags').click();
    const picker = this.page.getByRole('dialog', { name: 'Select tags' });
    await picker.getByRole('option', { name: tag, exact: true }).click();
    // The picker stays open for more tags; Escape closes the picker only, not the dialog.
    await this.page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    await expect(this.dropdown('Select tags')).toContainText(tag);
  }

  /** A dropdown's box, found by its button's name, which ends with e.g. "Select lifecycle". */
  private dropdown(buttonName: string): Locator {
    return this.root
      .getByRole('group')
      .filter({ has: this.page.getByRole('button', { name: new RegExp(`${buttonName}$`) }) });
  }
}
