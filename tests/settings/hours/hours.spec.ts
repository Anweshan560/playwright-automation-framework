import { test, expect } from '../../../fixtures/test';
import { weekdayHours } from '../../../api/WorkspaceApi';
import { runOnlyOnItsOwn } from '../exclusive';
import { buildOffDay, toDateParam } from '../../../utils/testData';

// Working hours drive SLA clocks and off days close the workspace, so these tests run on their
// own and put the workspace's hours back afterwards.
test.describe('Settings → Hours', { tag: ['@settings', '@hours'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ workspaceApi, cleanup }) => {
    cleanup.add('restore the workspace hours', await workspaceApi.rememberCurrent());
    // Start from no working hours, the way the page looks for a new workspace.
    expect((await workspaceApi.update({ workingHours: null })).ok()).toBe(true);
  });

  test('should open Hours from the Settings menu with working hours off', async ({ page, hoursPage }) => {
    await test.step('go to Settings → Hours', () => hoursPage.openFromDashboard());
    await test.step('working hours are off, so SLA clocks count around the clock', async () => {
      await expect(hoursPage.workingHoursSwitch).not.toBeChecked();
      await expect(
        page.getByText('Not set. Response times and SLA clocks count around the clock.'),
      ).toBeVisible();
    });
  });

  test('should save Monday to Friday 9 to 5 when user turns on working hours', async ({
    hoursPage,
    workspaceApi,
  }) => {
    await test.step('open Settings → Hours', () => hoursPage.open());
    await test.step('turn on working hours', () => hoursPage.useWorkingHours(true));
    await test.step('the week starts as Monday to Friday, 9:00 AM to 5:00 PM, weekend closed', async () => {
      await expect(hoursPage.dayTimes('Monday')).toHaveText(['9:00 AM', '5:00 PM']);
      await expect(hoursPage.daySwitch('Friday')).toBeChecked();
      await expect(hoursPage.daySwitch('Saturday')).not.toBeChecked();
    });
    await test.step('save', () => hoursPage.save());

    await test.step('the server stored those hours, in effect from today', async () => {
      const workspace = await workspaceApi.current();
      expect(workspace.workingHours).toEqual(weekdayHours('09:00', '17:00'));
      expect(workspace.workingHoursEffectiveFrom).not.toBeNull();
    });
    await test.step('after a reload, working hours are on', async () => {
      await hoursPage.open();
      await expect(hoursPage.workingHoursSwitch).toBeChecked();
    });
  });

  test('should save Saturday as a working day when user opens it', async ({ hoursPage, workspaceApi }) => {
    await test.step('start with Monday to Friday working hours (through the API)', async () => {
      expect((await workspaceApi.update({ workingHours: weekdayHours('09:00', '17:00') })).ok()).toBe(true);
    });

    await test.step('open Settings → Hours and open Saturday', async () => {
      await hoursPage.open();
      await hoursPage.setDayOpen('Saturday', true);
    });
    await test.step('save', () => hoursPage.save());

    await test.step('the server has Saturday open, and Sunday still closed', async () => {
      const { workingHours } = await workspaceApi.current();
      expect(workingHours?.saturday).toHaveLength(1);
      expect(workingHours?.sunday).toEqual([]);
    });
  });

  test('should clear the working hours when user turns them off', async ({ hoursPage, workspaceApi }) => {
    await test.step('start with Monday to Friday working hours (through the API)', async () => {
      expect((await workspaceApi.update({ workingHours: weekdayHours('09:00', '17:00') })).ok()).toBe(true);
    });

    await test.step('open Settings → Hours, turn working hours off and save', async () => {
      await hoursPage.open();
      await hoursPage.useWorkingHours(false);
      await hoursPage.save();
    });

    await test.step('the server has no working hours any more', async () => {
      expect((await workspaceApi.current()).workingHours).toBeNull();
    });
  });

  test('should save an off day with its reason, and remove it again', async ({ hoursPage, workspaceApi }) => {
    const offDay = buildOffDay();
    const stored = { date: toDateParam(offDay.date), reason: offDay.reason };

    await test.step('open Settings → Hours, add an off day with a reason, and save', async () => {
      await hoursPage.open();
      await hoursPage.addOffDay(offDay.date, offDay.reason);
      await hoursPage.save();
    });
    await test.step('the server stored the date and reason', async () => {
      expect((await workspaceApi.current()).offDays).toContainEqual(stored);
    });

    await test.step('after a reload, remove that off day and save', async () => {
      await hoursPage.open();
      await hoursPage.removeOffDay(offDay.reason);
      await hoursPage.save();
    });
    await test.step('the server no longer has it', async () => {
      expect((await workspaceApi.current()).offDays).not.toContainEqual(stored);
    });
  });
});
