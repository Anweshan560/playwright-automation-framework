import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { waitForApiResponse } from '../../utils/network';

/**
 * Settings → Workspace → General: the workspace's name and ID, and how long a follow-up keeps
 * credit for a booking. Each section has its own Save button.
 */
export class WorkspaceGeneralPage {
  readonly navigation: SettingsNavigation;
  readonly idInput: Locator;
  readonly nameInput: Locator;
  readonly saveNameButton: Locator;
  readonly creditDaysInput: Locator;
  readonly increaseCreditDays: Locator;
  readonly decreaseCreditDays: Locator;
  readonly saveCreditButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly workspaceId: string,
  ) {
    this.navigation = new SettingsNavigation(page);
    const main = page.getByRole('main');
    this.idInput = main.getByRole('textbox', { name: 'Workspace ID' });
    this.nameInput = main.getByRole('textbox', { name: 'Workspace name' });
    this.creditDaysInput = main.getByRole('textbox', { name: 'Count bookings made within' });
    this.increaseCreditDays = main.getByRole('button', { name: 'Increase Count bookings made within' });
    this.decreaseCreditDays = main.getByRole('button', { name: 'Decrease Count bookings made within' });
    // The two sections' Save buttons have the same name: the first saves the name.
    this.saveNameButton = main.getByRole('button', { name: 'Save', exact: true }).first();
    this.saveCreditButton = main.getByRole('button', { name: 'Save', exact: true }).nth(1);
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Workspace', 'General');
    await expect(this.page).toHaveURL('/settings/workspace');
  }

  /** Open the page directly and wait until the workspace has loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', this.apiPath);
    await this.page.goto('/settings/workspace');
    expect((await loaded).ok(), 'the workspace should load').toBe(true);
    await expect(this.nameInput).not.toHaveValue('');
  }

  /** Rename the workspace and save. */
  async rename(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.saveAndWait(this.saveNameButton);
  }

  /**
   * Set the follow-up credit to `days` with the field's +/- buttons and save. The field only takes
   * typed numbers once it loses focus, so the buttons are the reliable way, as for a user.
   */
  async setCreditDays(days: number): Promise<void> {
    const current = Number(await this.creditDaysInput.inputValue());
    const button = days > current ? this.increaseCreditDays : this.decreaseCreditDays;
    for (let step = 0; step < Math.abs(days - current); step++) await button.click();
    await expect(this.creditDaysInput).toHaveValue(String(days));
    await this.saveAndWait(this.saveCreditButton);
  }

  /** The line under the field, e.g. "A follow-up marked done today counts a booking made before …". */
  get creditExample(): Locator {
    return this.page
      .getByRole('main')
      .getByText(/^A follow-up marked done today counts a booking made before /);
  }

  private get apiPath(): string {
    return `/v1/workspaces/${this.workspaceId}`;
  }

  private async saveAndWait(button: Locator): Promise<void> {
    await expect(button).toBeEnabled();
    const saved = waitForApiResponse(this.page, 'PATCH', this.apiPath);
    await button.click();
    expect((await saved).ok(), 'the server should save the workspace').toBe(true);
    await expect(button).toBeDisabled();
  }
}
