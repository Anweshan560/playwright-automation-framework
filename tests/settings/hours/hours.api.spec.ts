import { test, expect } from '../../../fixtures/test';
import { weekdayHours } from '../../../api/WorkspaceApi';
import { runOnlyOnItsOwn } from '../exclusive';
import { buildOffDay, toDateParam } from '../../../utils/testData';

// The workspace's hours: every test puts them back afterwards.
test.describe('Hours API', { tag: ['@settings', '@hours'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ workspaceApi, cleanup }) => {
    cleanup.add('restore the workspace hours', await workspaceApi.rememberCurrent());
  });

  test('should store working hours and the date they apply from', async ({ workspaceApi }) => {
    const hours = weekdayHours('08:00', '16:30');

    const response = await test.step('PATCH Monday to Friday 08:00–16:30', () =>
      workspaceApi.update({ workingHours: hours }));

    await test.step('responds 200 with those hours and a start date', async () => {
      expect(response.status()).toBe(200);
      const { data } = await response.json();
      expect(data.workingHours).toEqual(hours);
      expect(data.workingHoursEffectiveFrom).toEqual(expect.any(String));
    });
  });

  test('should clear the working hours', async ({ workspaceApi }) => {
    await test.step('set working hours', async () => {
      expect((await workspaceApi.update({ workingHours: weekdayHours('09:00', '17:00') })).ok()).toBe(true);
    });

    const response = await test.step('PATCH working hours to null', () =>
      workspaceApi.update({ workingHours: null }));

    await test.step('responds 200, with no working hours and no start date', async () => {
      expect(response.status()).toBe(200);
      const workspace = await workspaceApi.current();
      expect(workspace.workingHours).toBeNull();
      expect(workspace.workingHoursEffectiveFrom).toBeNull();
    });
  });

  for (const [description, workingHours, message] of [
    [
      'a day that ends before it starts',
      { monday: [{ start: '18:00', end: '09:00' }] },
      'workingHours.monday[0] must start before it ends',
    ],
    [
      'a day that is not a weekday',
      { funday: [{ start: '09:00', end: '17:00' }] },
      'workingHours.funday is not a weekday',
    ],
  ] as const) {
    test(`should reject working hours with ${description} with 422`, async ({ workspaceApi }) => {
      const response = await test.step(`PATCH working hours with ${description}`, () =>
        workspaceApi.update({ workingHours: workingHours as never }));

      await test.step(`responds 422 "${message}"`, async () => {
        expect(response.status()).toBe(422);
        expect((await response.json()).message).toEqual({ workingHours: message });
      });
    });
  }

  test('should store off days with their reasons, and clear them', async ({ workspaceApi }) => {
    const offDay = buildOffDay();
    const stored = { date: toDateParam(offDay.date), reason: offDay.reason };

    const response = await test.step('PATCH one off day', () => workspaceApi.update({ offDays: [stored] }));

    await test.step('responds 200 with that off day', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data.offDays).toEqual([stored]);
    });
    await test.step('PATCH an empty list clears it', async () => {
      expect((await workspaceApi.update({ offDays: [] })).ok()).toBe(true);
      expect((await workspaceApi.current()).offDays).toEqual([]);
    });
  });

  test('should reject an off day that is only a date with 422', async ({ workspaceApi }) => {
    const response = await test.step('PATCH an off day as a plain date', () =>
      workspaceApi.update({ offDays: ['2026-12-26' as never] }));

    await test.step('responds 422 asking for an object', async () => {
      expect(response.status()).toBe(422);
      expect((await response.json()).message).toEqual({
        'offDays.0': 'each value in nested property offDays must be either object or array',
      });
    });
  });
});
