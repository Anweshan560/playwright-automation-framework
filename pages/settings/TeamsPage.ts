import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTablePage } from './SettingsTablePage';
import type { TeamData } from '../../utils/testData';

/** Settings → Workspace → Teams: groups of users that conversations can be routed to. */
export class TeamsPage extends SettingsTablePage<TeamData> {
  /** Teams belong to a workspace, so their API path includes its id. */
  constructor(page: Page, workspaceId: string) {
    super(page, {
      path: '/settings/teams',
      menu: ['Workspace', 'Teams'],
      addButtonName: 'Add team',
      createDialog: { name: 'Create Team', submitButton: 'Create Team' },
      editDialog: { name: 'Edit Team', submitButton: 'Save Changes' },
      rowActionsButtonName: 'Team actions',
      deleteDialogName: 'Delete team',
      apiPath: `/v1/workspaces/${workspaceId}/teams`,
    });
  }

  rowKey(team: TeamData): string {
    return team.name;
  }

  protected async fillDialog(dialog: Locator, team: TeamData): Promise<void> {
    await dialog.getByRole('textbox', { name: 'Team name' }).fill(team.name);
    await dialog.getByRole('button', { name: `Select color ${team.color}` }).click();
    await this.strategyButton(dialog).click();
    // Options read "<label>\n<description>", so match the label at the start.
    await this.page.getByRole('option', { name: new RegExp(`^${team.strategy.label}`) }).click();
  }

  /**
   * Checks the name and strategy. The colour swatches don't expose which one is selected
   * (no aria-pressed), so the tests check the saved colour through the API instead.
   */
  protected async expectDialogValues(dialog: Locator, team: TeamData): Promise<void> {
    await expect(dialog.getByRole('textbox', { name: 'Team name' })).toHaveValue(team.name);
    await expect(this.strategyButton(dialog)).toContainText(team.strategy.label);
  }

  /** The dropdown's name is "<selected strategy> Auto-assign strategy". */
  private strategyButton(dialog: Locator): Locator {
    return dialog.getByRole('button', { name: /Auto-assign strategy$/ });
  }
}
