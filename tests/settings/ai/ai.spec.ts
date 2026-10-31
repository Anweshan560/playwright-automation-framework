import { test, expect } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../../exclusive';

// The master AI switch affects every conversation, so these tests run on their own and switch it
// back afterwards. They never turn on Echo replies, which would answer real conversations.
test.describe('Settings → AI', { tag: ['@settings', '@ai'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ workspaceApi, cleanup }) => {
    cleanup.add('restore the AI switch', await workspaceApi.rememberCurrent());
    expect((await workspaceApi.update({ config: { aiEnabled: false } })).ok()).toBe(true);
  });

  test('should keep every AI feature locked while AI is off', async ({ aiSettingsPage }) => {
    await test.step('go to Settings → AI', () => aiSettingsPage.openFromDashboard());
    await test.step('AI is off, the features are locked, and the page says why', async () => {
      await expect(aiSettingsPage.masterSwitch).not.toBeChecked();
      await expect(aiSettingsPage.echoRepliesSwitch).toBeDisabled();
      await expect(aiSettingsPage.lockedHint).toBeVisible();
    });
  });

  test('should save the master switch as soon as AI is turned on, and off again', async ({
    aiSettingsPage,
    workspaceApi,
  }) => {
    await test.step('open Settings → AI and turn AI on', async () => {
      await aiSettingsPage.open();
      await aiSettingsPage.setAiEnabled(true);
    });
    await test.step('the server stored it, and the locked hint is gone', async () => {
      expect((await workspaceApi.current()).config.aiEnabled).toBe(true);
      await expect(aiSettingsPage.lockedHint).toBeHidden();
    });
    await test.step('Echo replies still need Echo set up first, so they stay locked', async () => {
      await expect(aiSettingsPage.echoRepliesSwitch).toBeDisabled();
    });

    await test.step('turn AI off again', () => aiSettingsPage.setAiEnabled(false));
    await test.step('the server stored it off', async () => {
      expect((await workspaceApi.current()).config.aiEnabled).toBe(false);
    });
  });
});
