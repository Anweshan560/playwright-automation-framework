import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { setSwitch } from './switches';
import { waitForApiResponse } from '../../utils/network';

/** The clocks' names, as the page's tabs show them. */
export type SlaClockName =
  | 'First reply'
  | 'Subsequent reply'
  | 'Open conversation'
  | 'Follow-up overdue'
  | 'Echo waiting'
  | 'Unassigned';

/**
 * Settings → Inbox → SLAs: one tab per clock, each with a target and who is told when it runs
 * late. Changes collect in an "Unsaved SLA settings" bar until Save changes stores every clock.
 */
export class SlaPage {
  readonly navigation: SettingsNavigation;
  readonly unsavedBar: Locator;

  constructor(
    private readonly page: Page,
    private readonly workspaceId: string,
  ) {
    this.navigation = new SettingsNavigation(page);
    this.unsavedBar = page.getByRole('toolbar', { name: 'Unsaved SLA settings' });
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Inbox', 'SLAs');
    await expect(this.page).toHaveURL('/settings/sla');
  }

  /** Open the page directly and wait until the clocks have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', this.apiPath);
    await this.page.goto('/settings/sla');
    expect((await loaded).ok(), 'the SLAs should load').toBe(true);
  }

  /** The clock's tab; its name starts with the clock's state, e.g. "Off First reply". */
  tab(clock: SlaClockName): Locator {
    return this.page
      .getByRole('tablist', { name: 'SLA clocks' })
      .getByRole('tab', { name: new RegExp(` ${clock}$`) });
  }

  /** The tab's state badge, named "Off" or "Active" (it is a coloured dot, without text). */
  tabState(clock: SlaClockName): Locator {
    return this.tab(clock).getByRole('status');
  }

  async selectClock(clock: SlaClockName): Promise<void> {
    await this.tab(clock).click();
    await expect(this.tab(clock)).toHaveAttribute('aria-selected', 'true');
  }

  /** Turn the selected clock on or off; it is only stored once saved. */
  async setEnabled(clock: SlaClockName, on: boolean): Promise<void> {
    const panel = this.page.getByRole('tabpanel');
    await setSwitch(
      panel.getByRole('switch', { name: `Enable ${clock}` }),
      panel.getByText('Enabled', { exact: true }),
      on,
    );
  }

  /** The selected clock's target, e.g. "1" (hours). */
  targetInput(clock: SlaClockName): Locator {
    return this.page.getByRole('tabpanel').getByRole('textbox', { name: `${clock} duration` });
  }

  /** Set the target with the +/- buttons; it is only stored once saved. */
  async setTarget(clock: SlaClockName, value: number): Promise<void> {
    const panel = this.page.getByRole('tabpanel');
    const current = Number(await this.targetInput(clock).inputValue());
    const name = value > current ? `Increase ${clock} duration` : `Decrease ${clock} duration`;
    for (let step = 0; step < Math.abs(value - current); step++)
      await panel.getByRole('button', { name }).click();
    await expect(this.targetInput(clock)).toHaveValue(String(value));
  }

  /** The selected clock's unit button, showing e.g. "hours". */
  unitButton(clock: SlaClockName): Locator {
    return this.page.getByRole('tabpanel').getByRole('button', { name: `${clock} unit`, exact: false });
  }

  /** Press Save changes in the "Unsaved SLA settings" bar and wait for the server. */
  async save(): Promise<void> {
    const saved = waitForApiResponse(this.page, 'PUT', this.apiPath);
    await this.unsavedBar.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok(), 'the server should save the SLAs').toBe(true);
    await expect(this.unsavedBar).toBeHidden();
  }

  private get apiPath(): string {
    return `/v1/workspaces/${this.workspaceId}/slas`;
  }
}
