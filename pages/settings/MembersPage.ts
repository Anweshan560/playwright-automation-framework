import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { waitForApiResponse } from '../../utils/network';
import type { Invitee } from '../../utils/testData';

/** The "Invite user" dialog on the Members page. */
export class InviteUserDialog {
  readonly root: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly organizationRoleButton: Locator;
  readonly workspaceButton: Locator;
  readonly workspaceRoleButton: Locator;
  readonly sendInviteButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Invite user' });
    this.firstNameInput = this.root.getByRole('textbox', { name: 'First name' });
    this.lastNameInput = this.root.getByRole('textbox', { name: 'Last name' });
    this.emailInput = this.root.getByRole('textbox', { name: 'Email' });
    this.organizationRoleButton = this.root.getByRole('button', { name: 'Organization role' });
    // Each dropdown button's name is "<selected value> <label>", e.g. "newest org Workspace".
    // Case-sensitive endings keep "Add another workspace" and "Organization role" out.
    this.workspaceButton = this.root.getByRole('button', { name: /Workspace$/ });
    this.workspaceRoleButton = this.root.getByRole('button', { name: /Role$/ });
    this.sendInviteButton = this.root.getByRole('button', { name: 'Send invite' });
  }

  /** The validation message under a field, e.g. "Enter their email". */
  error(message: string): Locator {
    return this.root.getByText(message, { exact: true });
  }

  /**
   * Fill every field with `invitee`, giving access to `workspace` (by name). The dialog starts on
   * the first workspace the API lists, not the current one, so always choose it.
   */
  async fill(invitee: Invitee, workspace: string): Promise<void> {
    await this.firstNameInput.fill(invitee.firstName);
    await this.lastNameInput.fill(invitee.lastName);
    await this.emailInput.fill(invitee.email);
    await this.chooseOption(this.organizationRoleButton, invitee.organizationRole);
    await this.chooseOption(this.workspaceButton, workspace);
    await expect(this.workspaceButton).toHaveText(workspace);
    await this.chooseOption(this.workspaceRoleButton, invitee.workspaceRole);
  }

  /** The workspace the invitation will give access to, as shown in the dialog. */
  async selectedWorkspace(): Promise<string> {
    return (await this.workspaceButton.innerText()).trim();
  }

  /** Open a dropdown and pick an option. Options read "<name>\n<description>", so match the start. */
  private async chooseOption(dropdown: Locator, optionName: string): Promise<void> {
    await dropdown.click();
    await this.page.getByRole('option', { name: new RegExp(`^${optionName}\\b`) }).click();
  }
}

/** Settings → Organization → Members: everyone in the organization, and invitations. */
export class MembersPage {
  readonly navigation: SettingsNavigation;
  readonly usersTable: Locator;
  readonly inviteUserButton: Locator;
  readonly inviteDialog: InviteUserDialog;

  constructor(private readonly page: Page) {
    this.navigation = new SettingsNavigation(page);
    this.usersTable = page.getByRole('grid', { name: 'Organization users' });
    this.inviteUserButton = page.getByRole('button', { name: 'Invite user' });
    this.inviteDialog = new InviteUserDialog(page);
  }

  /** Go to this page through the sidebar and the Settings menu. */
  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Organization', 'Members');
    await expect(this.page).toHaveURL('/settings/users');
  }

  /** Open this page directly and wait until the user list has loaded from the server. */
  async open(): Promise<void> {
    const listLoaded = waitForApiResponse(this.page, 'GET', '/v1/organizations/users');
    await this.page.goto('/settings/users');
    expect((await listLoaded).ok(), 'the user list should load').toBe(true);
  }

  /** Press "Invite user" and wait for the empty dialog. */
  async openInviteDialog(): Promise<void> {
    await this.inviteUserButton.click();
    await expect(this.inviteDialog.root).toBeVisible();
  }

  /**
   * Press "Send invite" and wait for the server's answer.
   * @returns the new invitation's id, needed to revoke it afterwards.
   */
  async sendInvite(): Promise<string> {
    const sent = waitForApiResponse(this.page, 'POST', '/v1/organizations/invite-user');
    await this.inviteDialog.sendInviteButton.click();
    const response = await sent;
    expect(response.status(), 'the server should create the invitation').toBe(201);
    return (await response.json()).data.id;
  }

  /** The confirmation that appears after sending, e.g. "Invitation sent to a@example.com". */
  invitationSentMessage(email: string): Locator {
    return this.page.getByText(`Invitation sent to ${email}`);
  }

  /** The user-list row for `email`. */
  rowFor(email: string): Locator {
    return this.usersTable.getByRole('row').filter({ hasText: email });
  }
}
