import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTablePage } from './SettingsTablePage';
import type { SnippetData } from '../../utils/testData';

/** Settings → Content → Snippets: saved replies agents can send. */
export class SnippetsPage extends SettingsTablePage<SnippetData> {
  constructor(page: Page) {
    super(page, {
      path: '/settings/snippets',
      menu: ['Content', 'Snippets'],
      addButtonName: 'New snippet',
      createDialog: { name: 'Create Snippet', submitButton: 'Create' },
      editDialog: { name: 'Edit Snippet', submitButton: 'Update' },
      rowActionsButtonName: 'Snippet actions',
      deleteDialogName: 'Delete snippet',
      apiPath: '/v1/snippets',
    });
  }

  rowKey(snippet: SnippetData): string {
    return snippet.name;
  }

  protected async fillDialog(dialog: Locator, snippet: SnippetData): Promise<void> {
    await dialog.getByRole('textbox', { name: 'Name' }).fill(snippet.name);
    // The real radio input sits under the app's styled circle, which takes the clicks,
    // so click the option's label the way a user does, then confirm it got selected.
    await dialog.getByRole('radiogroup').getByText(snippet.visibility, { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: snippet.visibility, exact: true })).toBeChecked();
    await dialog.getByRole('textbox', { name: 'Content' }).fill(snippet.content);
  }

  protected async expectDialogValues(dialog: Locator, snippet: SnippetData): Promise<void> {
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(snippet.name);
    await expect(dialog.getByRole('radio', { name: snippet.visibility, exact: true })).toBeChecked();
    await expect(dialog.getByRole('textbox', { name: 'Content' })).toHaveValue(snippet.content);
  }
}
