import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { setSwitch } from './switches';
import { waitForApiResponse } from '../../utils/network';

/**
 * Settings → Inbox → Hours: opening hours, the team's working hours (by weekday), breaks and off
 * days. Changes collect in an "Unsaved hours" bar until Save changes stores them all at once.
 */
export class HoursPage {
  readonly navigation: SettingsNavigation;
  readonly main: Locator;
  readonly workingHoursSwitch: Locator;
  readonly unsavedBar: Locator;

  constructor(
    private readonly page: Page,
    private readonly workspaceId: string,
  ) {
    this.navigation = new SettingsNavigation(page);
    this.main = page.getByRole('main');
    this.workingHoursSwitch = this.main.getByRole('switch', { name: 'Use working hours' });
    this.unsavedBar = page.getByRole('toolbar', { name: 'Unsaved hours' });
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Inbox', 'Hours');
    await expect(this.page).toHaveURL('/settings/inbox');
  }

  /** Open the page directly and wait until the workspace's hours have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', this.apiPath);
    await this.page.goto('/settings/inbox');
    expect((await loaded).ok(), 'the hours should load').toBe(true);
    await expect(this.workingHoursSwitch).toBeVisible();
  }

  /** Turn "Use working hours" on or off; it is only stored once saved. */
  async useWorkingHours(on: boolean): Promise<void> {
    await setSwitch(this.workingHoursSwitch, this.main.getByText('Use working hours', { exact: true }), on);
  }

  /** The weekday's open/closed switch, e.g. "Saturday". */
  daySwitch(day: string): Locator {
    return this.main.getByRole('switch', { name: day, exact: true });
  }

  /** Open or close a weekday; it is only stored once saved. */
  async setDayOpen(day: string, open: boolean): Promise<void> {
    await setSwitch(this.daySwitch(day), this.main.getByText(day, { exact: true }), open);
  }

  /** The weekday's opening and closing time buttons, e.g. "9:00 AM" and "5:00 PM". */
  dayTimes(day: string): Locator {
    return (
      this.main
        .locator('div')
        // Inside `has`, locators are relative to each box, so ask for the switch itself.
        .filter({ has: this.page.getByRole('switch', { name: day, exact: true }) })
        .filter({ has: this.page.getByRole('button', { name: /^\d{1,2}:\d{2} [AP]M$/ }) })
        .last()
        .getByRole('button', { name: /^\d{1,2}:\d{2} [AP]M$/ })
    );
  }

  /** Add an off day with its reason; it is only stored once saved. */
  async addOffDay(date: Date, reason: string): Promise<void> {
    await this.main.getByRole('button', { name: 'Add an off day' }).click();
    const dateField = this.main.getByRole('group', { name: 'Off day date' }).last();
    // A date field: type the month, day and year; each part moves on to the next by itself.
    await dateField.getByRole('spinbutton', { name: /^month/ }).click();
    const pad = (n: number) => String(n).padStart(2, '0');
    await this.page.keyboard.type(`${pad(date.getMonth() + 1)}${pad(date.getDate())}${date.getFullYear()}`);
    await expect(dateField.getByRole('spinbutton', { name: /^year/ })).toHaveText(String(date.getFullYear()));
    await this.main.getByRole('textbox', { name: 'Reason' }).last().fill(reason);
  }

  /** Remove the off day with this reason; it is only stored once saved. */
  async removeOffDay(reason: string): Promise<void> {
    const reasons = this.main.getByRole('textbox', { name: 'Reason' });
    const index = await reasons.evaluateAll(
      (inputs, wanted) => inputs.findIndex((input) => (input as HTMLInputElement).value === wanted),
      reason,
    );
    expect(index, `an off day with reason "${reason}" should be listed`).toBeGreaterThanOrEqual(0);
    // Each off day has one Remove button, in the same order as the reasons.
    await this.main.getByRole('button', { name: 'Remove off day' }).nth(index).click();
  }

  /** Press Save changes in the "Unsaved hours" bar and wait for the server. */
  async save(): Promise<void> {
    await expect(this.unsavedBar).toContainText('Unsaved changes');
    const saved = waitForApiResponse(this.page, 'PATCH', this.apiPath);
    await this.unsavedBar.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok(), 'the server should save the hours').toBe(true);
    await expect(this.unsavedBar).toBeHidden();
  }

  private get apiPath(): string {
    return `/v1/workspaces/${this.workspaceId}`;
  }
}
