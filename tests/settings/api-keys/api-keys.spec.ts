import { test, expect } from '../../../fixtures/test';
import { describeSettingsTableUi } from '../settingsTableSuite';
import { API_KEYS } from '../settingsTables';
import { ApiKeysPage } from '../../../pages/settings/ApiKeysPage';
import { buildApiKey } from '../../../utils/testData';

// Create, edit and delete through the UI; the shared steps are in settingsTableSuite.ts.
describeSettingsTableUi(API_KEYS);

test.describe('Settings → API Keys: the key itself', { tag: API_KEYS.tags }, () => {
  test('should show the new key once, and it should be the key the server stored', async ({
    page,
    apiKeysApi,
    cleanup,
  }) => {
    const apiKeysPage = new ApiKeysPage(page);
    const apiKey = buildApiKey();

    await test.step('open Settings → API Keys', () => apiKeysPage.open());
    const id = await test.step('create a key, and keep the "API key created" dialog open', () =>
      apiKeysPage.createKeepingKeyShown(apiKey));
    cleanup.add(`API key ${apiKey.name}`, () => apiKeysApi.deleteIfExists(id));

    await test.step('the dialog warns it is shown only now', async () => {
      await expect(apiKeysPage.createdDialog).toContainText('You will not be able to view it again');
    });
    await test.step('the key shown is the one the server created', async () => {
      const shown = await apiKeysPage.shownKey();
      const stored = (await (await apiKeysApi.get(id)).json()).data.key;
      // Compare without printing either value: they are real credentials.
      expect(shown.startsWith('sk_'), 'the key should start with sk_').toBe(true);
      expect(shown === stored, 'the dialog should show the stored key').toBe(true);
    });
    await test.step('after Done, the list hides the key', async () => {
      await apiKeysPage.closeCreatedDialog();
      await expect(apiKeysPage.rowFor(apiKey)).toContainText('•••');
    });
  });
});
