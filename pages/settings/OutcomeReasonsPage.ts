import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { ENDPOINTS } from '../../api/ResourceApi';
import { waitForApiResponse } from '../../utils/network';
import { collapseSetupGuide } from '../setupGuide';
import { OUTCOME_ANSWERS, type OutcomeAnswerName, type OutcomeReasonData } from '../../utils/testData';

/**
 * Settings → Inbox → Outcome Reasons: why a conversation ended without a booking.
 * Reasons are added from a box under the list, and edited and deleted in place (no dialogs).
 */
export class OutcomeReasonsPage {
  readonly navigation: SettingsNavigation;
  readonly newReasonInput: Locator;
  readonly addButton: Locator;

  constructor(private readonly page: Page) {
    this.navigation = new SettingsNavigation(page);
    this.newReasonInput = page.getByRole('textbox', { name: 'New reason' });
    this.addButton = page.getByRole('main').getByRole('button', { name: 'Add', exact: true });
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Inbox', 'Outcome Reasons');
    await expect(this.page).toHaveURL('/settings/outcome-reasons');
  }

  /** Open the page directly and wait until the reasons have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', ENDPOINTS.outcomeReasons);
    await this.page.goto('/settings/outcome-reasons');
    expect((await loaded).ok(), 'the reasons should load').toBe(true);
  }

  /** The reason's Edit button: there is one only while the reason is listed. */
  editButton(label: string): Locator {
    // .first(): the app nests a second, identical button inside each one.
    return this.page.getByRole('button', { name: `Edit ${label}`, exact: true }).first();
  }

  /**
   * The line under a reason: where it is shown, in the page's order,
   * e.g. "Nothing booked · Not interested".
   */
  summary(reason: OutcomeReasonData): Locator {
    const inPageOrder = (Object.keys(OUTCOME_ANSWERS) as OutcomeAnswerName[]).filter((answer) =>
      reason.showUnder.includes(answer),
    );
    return this.reasonEntry(reason.label).getByText(inPageOrder.join(' · '), { exact: true });
  }

  /** The reason's entry in the list: its label, summary and buttons. */
  reasonEntry(label: string): Locator {
    // The innermost box holding both the label and its Edit button is this reason's entry.
    return this.page
      .getByRole('main')
      .locator('div')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .filter({ has: this.editButton(label) })
      .last();
  }

  /**
   * Add a reason from the box under the list.
   * @returns the new reason's id, taken from the server's answer.
   */
  async addReason(label: string): Promise<string> {
    await this.newReasonInput.fill(label);
    const created = waitForApiResponse(this.page, 'POST', ENDPOINTS.outcomeReasons);
    await this.addButton.click();
    const response = await created;
    expect(response.status(), 'the server should create the reason').toBe(201);
    await expect(this.newReasonInput).toHaveValue('');
    return (await response.json()).data.id;
  }

  /** Change the reason `currentLabel` to `updated` in place, and save. */
  async editReason(currentLabel: string, updated: OutcomeReasonData): Promise<void> {
    await collapseSetupGuide(this.page);
    await this.editButton(currentLabel).click();
    const labelInput = this.page.getByRole('textbox', { name: 'Reason label' });
    await labelInput.fill(updated.label);
    const showUnder = this.page.getByRole('group', { name: 'Show under' });
    for (const answer of Object.keys(OUTCOME_ANSWERS) as OutcomeAnswerName[]) {
      const checkbox = showUnder.getByRole('checkbox', { name: answer, exact: true });
      if ((await checkbox.isChecked()) !== updated.showUnder.includes(answer)) {
        // The real checkbox sits under the app's styled box, so click its label as a user does.
        await showUnder.getByText(answer, { exact: true }).click();
      }
      await expect(checkbox).toBeChecked({ checked: updated.showUnder.includes(answer) });
    }
    const saved = waitForApiResponse(this.page, 'PATCH', new RegExp(`^${ENDPOINTS.outcomeReasons}/[^/]+$`));
    await this.page.getByRole('main').getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).ok(), 'the server should save the changes').toBe(true);
    await expect(labelInput).toBeHidden();
  }

  /** Press the reason's Delete button; the page asks to confirm in place. */
  async startDelete(label: string): Promise<Locator> {
    await collapseSetupGuide(this.page);
    await this.page
      .getByRole('button', { name: `Delete ${label}`, exact: true })
      .first()
      .click();
    const question = this.page.getByText(`Delete “${label}”?`, { exact: true });
    await expect(question).toBeVisible();
    return question;
  }

  /** Delete the reason, confirming the question that names it. */
  async deleteReason(label: string): Promise<void> {
    await this.startDelete(label);
    const deleted = waitForApiResponse(
      this.page,
      'DELETE',
      new RegExp(`^${ENDPOINTS.outcomeReasons}/[^/]+$`),
    );
    await this.page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await deleted).ok(), 'the server should delete the reason').toBe(true);
  }
}
