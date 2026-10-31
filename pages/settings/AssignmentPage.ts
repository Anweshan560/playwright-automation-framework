import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { setSwitch } from './switches';
import { waitForApiResponse } from '../../utils/network';

const REQUIRE_TEAM = 'Require a team when assigning';
const REASSIGN_ON_REPLY = 'Hand the conversation to whoever replies, even if a teammate is already assigned';

/** Settings → Inbox → Assignment: two rules, each saved the moment its switch is flipped. */
export class AssignmentPage {
  readonly navigation: SettingsNavigation;
  readonly requireTeamSwitch: Locator;
  readonly reassignOnReplySwitch: Locator;

  constructor(private readonly page: Page) {
    this.navigation = new SettingsNavigation(page);
    this.requireTeamSwitch = page.getByRole('switch', { name: REQUIRE_TEAM });
    this.reassignOnReplySwitch = page.getByRole('switch', { name: REASSIGN_ON_REPLY });
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Inbox', 'Assignment');
    await expect(this.page).toHaveURL('/settings/assignment');
  }

  /** Open the page directly and wait until the rules have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', '/v1/workspace-assignments');
    await this.page.goto('/settings/assignment');
    expect((await loaded).ok(), 'the assignment rules should load').toBe(true);
  }

  /** Flip "Require a team when assigning" and wait for the server to save it. */
  async setRequireTeam(on: boolean): Promise<void> {
    await this.flip(this.requireTeamSwitch, REQUIRE_TEAM, on);
  }

  /** Flip "Hand the conversation to whoever replies…" and wait for the server to save it. */
  async setReassignOnReply(on: boolean): Promise<void> {
    await this.flip(this.reassignOnReplySwitch, REASSIGN_ON_REPLY, on);
  }

  private async flip(toggle: Locator, label: string, on: boolean): Promise<void> {
    const saved = waitForApiResponse(this.page, 'PATCH', '/v1/workspace-assignments');
    await setSwitch(toggle, this.page.getByRole('main').getByText(label, { exact: true }), on);
    expect((await saved).ok(), 'the server should save the rule').toBe(true);
  }
}
