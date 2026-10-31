import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsNavigation } from './SettingsNavigation';
import { waitForApiResponse } from '../../utils/network';
import { collapseSetupGuide } from '../setupGuide';
import { CONTACT_VISIBILITY, type RoleData } from '../../utils/testData';

/**
 * Settings → Workspace → Roles: the list of roles, and the role editor (a page of its own) that
 * creates and edits them. A new role always starts from a built-in one, or from scratch.
 */
export class RolesPage {
  readonly navigation: SettingsNavigation;
  readonly table: Locator;
  readonly newRoleButton: Locator;
  readonly startFromDialog: Locator;
  readonly deleteDialog: Locator;
  readonly editor: RoleEditor;

  constructor(
    private readonly page: Page,
    private readonly workspaceId: string,
  ) {
    this.navigation = new SettingsNavigation(page);
    this.table = page.getByRole('grid', { name: 'Roles' });
    this.newRoleButton = page.getByRole('button', { name: 'New role', exact: true });
    this.startFromDialog = page.getByRole('dialog', { name: 'Start from a role' });
    this.deleteDialog = page.getByRole('dialog', { name: 'Delete role' });
    this.editor = new RoleEditor(page, this.apiPath);
  }

  async openFromDashboard(): Promise<void> {
    await this.navigation.openFromDashboard('Workspace', 'Roles');
    await expect(this.page).toHaveURL('/settings/roles');
  }

  /** Open the list directly and wait until the roles have loaded. */
  async open(): Promise<void> {
    const loaded = waitForApiResponse(this.page, 'GET', this.apiPath);
    await this.page.goto('/settings/roles');
    expect((await loaded).ok(), 'the roles should load').toBe(true);
    await expect(this.table).toBeVisible();
  }

  /** The role's row, e.g. "Admin Built-in". */
  row(name: string): Locator {
    return this.table.getByRole('row', { name: new RegExp(`^${escapeRegExp(name)}( Built-in)?$`) });
  }

  /** Press New role and pick the role to start from; the editor opens. */
  async startNewRole(from: RoleData['startFrom'] | 'From scratch'): Promise<void> {
    await this.newRoleButton.click();
    await expect(this.startFromDialog).toBeVisible();
    await this.startFromDialog.getByRole('option', { name: new RegExp(`^${from}`) }).click();
    await expect(this.editor.heading).toHaveText('New role');
  }

  /** Create `role` from the list, through the editor. @returns the new role's id. */
  async createRole(role: RoleData): Promise<string> {
    await this.startNewRole(role.startFrom);
    await this.editor.fill(role);
    return this.editor.create();
  }

  /** The items of the role's actions menu, e.g. ["Edit", "Copy role", "Delete"]. */
  async actionsOf(name: string): Promise<string[]> {
    await this.openActions(name);
    const items = await this.page
      .getByRole('menu', { name: 'Role actions' })
      .getByRole('menuitem')
      .allInnerTexts();
    await this.page.keyboard.press('Escape');
    return items.map((item) => item.trim());
  }

  /** Choose an item from the role's actions menu. */
  async chooseAction(name: string, action: 'Edit' | 'Copy role' | 'Delete'): Promise<void> {
    await this.openActions(name);
    await this.page
      .getByRole('menu', { name: 'Role actions' })
      .getByRole('menuitem', { name: action })
      .click();
  }

  /** Delete the role, confirming the dialog that names it. */
  async deleteRole(name: string): Promise<void> {
    await this.chooseAction(name, 'Delete');
    await expect(this.deleteDialog).toContainText(`Delete "${name}"?`);
    const deleted = waitForApiResponse(this.page, 'DELETE', new RegExp(`^${this.apiPath}/[^/]+$`));
    await this.deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await deleted).ok(), 'the server should delete the role').toBe(true);
    await expect(this.deleteDialog).toBeHidden();
  }

  private get apiPath(): string {
    return `/v1/workspaces/${this.workspaceId}/roles`;
  }

  private async openActions(name: string): Promise<void> {
    await collapseSetupGuide(this.page);
    // .first(): the app nests a second, identical button inside each one.
    await this.row(name).getByRole('button', { name: 'Role actions' }).first().click();
  }
}

/** The role editor: name, description, which contacts the role sees, and its permissions. */
export class RoleEditor {
  readonly heading: Locator;
  readonly main: Locator;
  readonly summary: Locator;
  readonly footer: Locator;

  constructor(
    private readonly page: Page,
    private readonly apiPath: string,
  ) {
    this.heading = page.getByRole('banner').getByRole('heading', { level: 4 });
    this.main = page.getByRole('main');
    this.summary = this.main.getByRole('complementary');
    this.footer = page.getByRole('contentinfo');
  }

  get nameInput(): Locator {
    return this.main.getByRole('textbox', { name: 'Name' });
  }

  get descriptionInput(): Locator {
    return this.main.getByRole('textbox', { name: 'Description' });
  }

  /** A permission's checkbox, e.g. ("Contacts", "Delete"). */
  permission(area: string, label: string): Locator {
    return this.main
      .getByRole('group', { name: area, exact: true })
      .getByRole('checkbox', { name: label, exact: true });
  }

  /** Fill the name, description and contact access, and tick the extra permissions. */
  async fill(role: RoleData): Promise<void> {
    await this.nameInput.fill(role.name);
    await this.descriptionInput.fill(role.description);
    await this.chooseContactVisibility(role.contactVisibility);
    for (const { area, label } of role.extraPermissions) {
      const checkbox = this.permission(area, label);
      // The real checkbox sits under the app's styled box, so click its label as a user does.
      if (!(await checkbox.isChecked())) {
        await this.main
          .getByRole('group', { name: area, exact: true })
          .getByText(label, { exact: true })
          .click();
      }
      await expect(checkbox).toBeChecked();
    }
  }

  async chooseContactVisibility(visibility: keyof typeof CONTACT_VISIBILITY): Promise<void> {
    const options = this.main.getByRole('radiogroup', { name: 'Contacts they see' });
    await options.getByText(visibility, { exact: true }).click();
    await expect(options.getByRole('radio', { name: visibility })).toBeChecked();
  }

  /** Press Create role and wait for the server. @returns the new role's id. */
  async create(): Promise<string> {
    const created = waitForApiResponse(this.page, 'POST', this.apiPath);
    await this.footer.getByRole('button', { name: 'Create role' }).click();
    const response = await created;
    expect(response.status(), 'the server should create the role').toBe(201);
    await expect(this.page).toHaveURL('/settings/roles');
    return (await response.json()).data.id;
  }

  /** Press Save changes and wait for the server. */
  async save(): Promise<void> {
    const saved = waitForApiResponse(this.page, 'PATCH', new RegExp(`^${this.apiPath}/[^/]+$`));
    await this.footer.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok(), 'the server should save the role').toBe(true);
    await expect(this.page).toHaveURL('/settings/roles');
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
