import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { waitForApiResponse } from '../../utils/network';
import { collapseSetupGuide } from '../setupGuide';

/**
 * Settings → Workspace → Members: the people in this workspace and their roles. "Add user"
 * invites someone with a role; until they accept, their row offers Resend and Revoke.
 * Real teammates are listed too: tests only act on the @example.com users they added.
 */
export class WorkspaceUsersPage {
  readonly navigation: SettingsNavigation;
  readonly table: Locator;
  readonly addUserButton: Locator;
  readonly addUserDialog: Locator;

  constructor(
    private readonly page: Page,
    private readonly workspaceId: string,
  ) {
    this.navigation = new SettingsNavigation(page);
    this.table = page.getByRole('grid', { name: 'Workspace users' });
    // In the header: the dialog's submit button has the same name.
    this.addUserButton = page.getByRole('banner').getByRole('button', { name: 'Add user', exact: true });
    this.addUserDialog = page.getByRole('dialog', { name: 'Add User' });
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Workspace', 'Members');
    await expect(this.page).toHaveURL('/settings/workspace-users');
  }

  /** Open the page directly and wait until the users have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', this.apiPath);
    await this.page.goto('/settings/workspace-users');
    expect((await loaded).ok(), 'the users should load').toBe(true);
    await expect(this.table).toBeVisible();
  }

  /** The user's row, found by email. */
  row(email: string): Locator {
    return this.table.getByRole('row').filter({ hasText: email });
  }

  /** Open Add user, fill it in with `role` (by name), and add. @returns the invitation id. */
  async addUser(user: { firstName: string; lastName: string; email: string }, role: string): Promise<string> {
    await this.addUserButton.click();
    await expect(this.addUserDialog).toBeVisible();
    await this.addUserDialog.getByRole('textbox', { name: 'First name' }).fill(user.firstName);
    await this.addUserDialog.getByRole('textbox', { name: 'Last name' }).fill(user.lastName);
    await this.addUserDialog.getByRole('textbox', { name: 'Email' }).fill(user.email);
    await this.chooseRole(role);
    const added = waitForApiResponse(this.page, 'POST', this.apiPath);
    await this.addUserDialog.getByRole('button', { name: 'Add user' }).click();
    const response = await added;
    expect(response.status(), 'the server should add the user').toBe(201);
    await expect(this.addUserDialog).toBeHidden();
    return (await response.json()).data.id;
  }

  /** Pick the role in the Add user dialog; options read "<role> <who they see>". */
  async chooseRole(role: string): Promise<void> {
    await this.addUserDialog.getByRole('button', { name: / Role$/ }).click();
    await this.page
      .getByRole('listbox', { name: 'Role' })
      .getByRole('option', { name: new RegExp(`^${role} `) })
      .click();
    await expect(this.addUserDialog.getByRole('button', { name: / Role$/ })).toHaveText(role);
  }

  /** The items of the user's actions menu, e.g. ["Resend invitation", "Revoke invitation"]. */
  async actionsOf(email: string): Promise<string[]> {
    await this.openActions(email);
    const items = await this.page
      .getByRole('menu', { name: 'User actions' })
      .getByRole('menuitem')
      .allInnerTexts();
    await this.page.keyboard.press('Escape');
    return items.map((item) => item.trim());
  }

  /** Revoke the user's invitation from their actions menu, confirming the warning. */
  async revokeInvitation(email: string): Promise<void> {
    await this.openActions(email);
    await this.page
      .getByRole('menu', { name: 'User actions' })
      .getByRole('menuitem', { name: 'Revoke invitation' })
      .click();
    const confirm = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Revoke invitation' }) });
    await expect(confirm).toContainText("The invitation stops working and they can't join with it.");
    const revoked = waitForApiResponse(
      this.page,
      'PATCH',
      /^\/v1\/organizations\/invitations\/[^/]+\/revoke$/,
    );
    await confirm.getByRole('button', { name: 'Revoke', exact: true }).click();
    expect((await revoked).ok(), 'the server should revoke the invitation').toBe(true);
    await expect(confirm).toBeHidden();
  }

  private get apiPath(): string {
    return `/v1/workspaces/${this.workspaceId}/users`;
  }

  private async openActions(email: string): Promise<void> {
    await collapseSetupGuide(this.page);
    // .first(): the app nests a second, identical button inside each one.
    await this.row(email).getByRole('button', { name: 'User actions' }).first().click();
  }
}
