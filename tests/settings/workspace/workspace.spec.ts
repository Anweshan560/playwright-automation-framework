import { test, expect } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../exclusive';
import { buildWorkspaceName } from '../../../utils/testData';

// The test workspace itself: every test puts its name and settings back afterwards.
test.describe('Settings → Workspace → General', { tag: ['@settings', '@workspace'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ workspaceApi, cleanup }) => {
    cleanup.add('restore the workspace', await workspaceApi.rememberCurrent());
  });

  test('should open Workspace General from the Settings menu with the workspace ID', async ({
    workspaceGeneralPage,
    workspaceId,
  }) => {
    await test.step('go to Settings → Workspace → General', () => workspaceGeneralPage.openFromDashboard());
    await test.step("it shows this workspace's ID", async () => {
      await expect(workspaceGeneralPage.idInput).toHaveValue(workspaceId);
    });
  });

  test('should save the new name when user renames the workspace', async ({
    workspaceGeneralPage,
    workspaceApi,
  }) => {
    const name = buildWorkspaceName();

    await test.step('open Settings → Workspace → General', () => workspaceGeneralPage.open());
    await test.step('type a new name and press Save', () => workspaceGeneralPage.rename(name));

    await test.step('after a reload, the new name is shown', async () => {
      await workspaceGeneralPage.open();
      await expect(workspaceGeneralPage.nameInput).toHaveValue(name);
    });
    await test.step('the server stored it', async () => {
      expect((await workspaceApi.current()).name).toBe(name);
    });
  });

  test('should keep Save disabled until the name changes', async ({ workspaceGeneralPage }) => {
    await test.step('open Settings → Workspace → General', () => workspaceGeneralPage.open());
    await test.step('Save is disabled while nothing has changed', async () => {
      await expect(workspaceGeneralPage.saveNameButton).toBeDisabled();
    });
    await test.step('editing the name enables it', async () => {
      await workspaceGeneralPage.nameInput.fill(buildWorkspaceName());
      await expect(workspaceGeneralPage.saveNameButton).toBeEnabled();
    });
  });

  test('should save the follow-up credit and explain what it means', async ({
    workspaceGeneralPage,
    workspaceApi,
  }) => {
    const current = (await workspaceApi.current()).config.followUpCreditWindowDays ?? 30;
    // Three days more (or fewer, near the 365 limit), so the +/- buttons get there in a few clicks.
    const days = current > 362 ? current - 3 : current + 3;

    await test.step('open Settings → Workspace → General', () => workspaceGeneralPage.open());
    await test.step(`change the follow-up credit to ${days} days and press Save`, () =>
      workspaceGeneralPage.setCreditDays(days));

    await test.step('the example under it counts the new number of days from today', async () => {
      const lastDay = new Date();
      lastDay.setDate(lastDay.getDate() + days);
      const formatted = lastDay.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      await expect(workspaceGeneralPage.creditExample).toContainText(formatted);
    });
    await test.step('after a reload the new value is shown, and the server stored it', async () => {
      await workspaceGeneralPage.open();
      await expect(workspaceGeneralPage.creditDaysInput).toHaveValue(String(days));
      expect((await workspaceApi.current()).config.followUpCreditWindowDays).toBe(days);
    });
  });
});
