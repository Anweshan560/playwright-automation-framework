import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTablePage } from './SettingsTablePage';
import type { SavedFileData } from '../../utils/testData';

/** The image every saved-file UI test uploads. */
export const SAMPLE_FILE = path.join(__dirname, '../../tests/assets/sample.png');

/** Settings → Content → Files: files saved for reuse in conversations. */
export class SavedFilesPage extends SettingsTablePage<SavedFileData> {
  constructor(page: Page) {
    super(page, {
      path: '/settings/files',
      menu: ['Content', 'Files'],
      addButtonName: 'New saved file',
      createDialog: { name: 'Create Saved File', submitButton: 'Create' },
      editDialog: { name: 'Edit Saved File', submitButton: 'Update' },
      rowActionsButtonName: 'Saved file actions',
      deleteDialogName: 'Delete saved file',
      apiPath: '/v1/saved-files',
    });
  }

  rowKey(file: SavedFileData): string {
    return file.name;
  }

  /** Fills the name; in the create dialog it also uploads the sample image (edit keeps the file). */
  protected async fillDialog(dialog: Locator, file: SavedFileData): Promise<void> {
    await dialog.getByRole('textbox', { name: 'Name' }).fill(file.name);
    const browseButton = dialog.getByRole('button', { name: 'Browse file' });
    if (await browseButton.isVisible()) {
      const fileChooser = this.page.waitForEvent('filechooser');
      await browseButton.click();
      await (await fileChooser).setFiles(SAMPLE_FILE);
    }
  }

  protected async expectDialogValues(dialog: Locator, file: SavedFileData): Promise<void> {
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(file.name);
    // The uploaded file is listed with a remove button named after the record. (A "Preview" button
    // shows only when the image loads, which the API-created records' placeholder URLs never do.)
    await expect(dialog.getByRole('button', { name: `Remove ${file.name}` })).toBeVisible();
  }
}
