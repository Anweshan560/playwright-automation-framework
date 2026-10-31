import { test, expect } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../../exclusive';

// Assignment rules change how every conversation is assigned, so these tests run on their own and
// put the rules back afterwards.
test.describe('Settings → Assignment', { tag: ['@settings', '@assignment'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ assignmentApi, cleanup }) => {
    cleanup.add('restore the assignment rules', await assignmentApi.rememberCurrent());
    // Start from the app's defaults: no team needed, and replies reassign.
    expect((await assignmentApi.update({ requireTeamOnAssign: false, reassignToReplier: true })).ok()).toBe(
      true,
    );
  });

  test('should open Assignment from the Settings menu with the default rules', async ({ assignmentPage }) => {
    await test.step('go to Settings → Assignment', () => assignmentPage.openFromDashboard());
    await test.step('no team is required, and a reply hands the conversation over', async () => {
      await expect(assignmentPage.requireTeamSwitch).not.toBeChecked();
      await expect(assignmentPage.reassignOnReplySwitch).toBeChecked();
    });
  });

  test('should save "Require a team when assigning" as soon as it is flipped', async ({
    assignmentPage,
    assignmentApi,
  }) => {
    await test.step('open Settings → Assignment', () => assignmentPage.open());
    await test.step('turn on "Require a team when assigning"', () => assignmentPage.setRequireTeam(true));

    await test.step('the server stored it, and kept the other rule', async () => {
      expect(await assignmentApi.current()).toEqual({ requireTeamOnAssign: true, reassignToReplier: true });
    });
    await test.step('after a reload it is still on', async () => {
      await assignmentPage.open();
      await expect(assignmentPage.requireTeamSwitch).toBeChecked();
    });
  });

  test('should save "reassign on reply" as soon as it is flipped', async ({
    assignmentPage,
    assignmentApi,
  }) => {
    await test.step('open Settings → Assignment', () => assignmentPage.open());
    await test.step('turn off handing the conversation to whoever replies', () =>
      assignmentPage.setReassignOnReply(false));

    await test.step('the server stored it, and kept the other rule', async () => {
      expect(await assignmentApi.current()).toEqual({ requireTeamOnAssign: false, reassignToReplier: false });
    });
    await test.step('after a reload it is still off', async () => {
      await assignmentPage.open();
      await expect(assignmentPage.reassignOnReplySwitch).not.toBeChecked();
    });
  });
});
