import { test, expect } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../../exclusive';
import { env } from '../../../config/env';

// Assignment rules change how every conversation is assigned: tests run on their own and put
// the rules back afterwards.
test.describe('Assignment API', { tag: ['@settings', '@assignment'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ assignmentApi, cleanup }) => {
    cleanup.add('restore the assignment rules', await assignmentApi.rememberCurrent());
  });

  test('should return both assignment rules', async ({ assignmentApi }) => {
    const response = await test.step('GET the rules', () => assignmentApi.get());

    await test.step('responds 200 with both rules as true/false', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toEqual({
        requireTeamOnAssign: expect.any(Boolean),
        reassignToReplier: expect.any(Boolean),
      });
    });
  });

  for (const rule of ['requireTeamOnAssign', 'reassignToReplier'] as const) {
    test(`should change ${rule} on its own`, async ({ assignmentApi }) => {
      const before = await assignmentApi.current();

      const response = await test.step(`PATCH only ${rule}`, () =>
        assignmentApi.update({ [rule]: !before[rule] }));

      await test.step(`responds 200; ${rule} flipped and the other rule kept its value`, async () => {
        expect(response.status()).toBe(200);
        expect(await assignmentApi.current()).toEqual({ ...before, [rule]: !before[rule] });
      });
    });
  }

  test('should reject a rule that is not true or false with 422', async ({ assignmentApi }) => {
    const before = await assignmentApi.current();

    const response = await test.step('PATCH requireTeamOnAssign = "yes"', () =>
      assignmentApi.update({ requireTeamOnAssign: 'yes' as never }));

    await test.step('responds 422 naming the rule, and nothing changed', async () => {
      expect(response.status()).toBe(422);
      expect(Object.keys((await response.json()).message)).toEqual(['requireTeamOnAssign']);
      expect(await assignmentApi.current()).toEqual(before);
    });
  });

  test('should reject a request without a login token with 401', async ({
    request,
    assignmentApi,
    apiHeaders,
  }) => {
    const { authorization: _omitted, ...headersWithoutToken } = await apiHeaders();

    const response = await test.step('GET the rules without a login token', () =>
      request.get(`${env.apiUrl}${assignmentApi.path}`, { headers: headersWithoutToken }));

    await test.step('responds 401', () => expect(response.status()).toBe(401));
  });
});
