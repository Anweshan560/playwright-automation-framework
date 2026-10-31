import { test, expect } from '../../../fixtures/test';
import { runOnlyOnItsOwn } from '../../exclusive';

// The master AI switch is `config.aiEnabled` on the workspace: tests run on their own and switch
// it back afterwards.
test.describe('AI switch API', { tag: ['@settings', '@ai'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ workspaceApi, cleanup }) => {
    cleanup.add('restore the AI switch', await workspaceApi.rememberCurrent());
  });

  for (const aiEnabled of [true, false]) {
    test(`should turn AI ${aiEnabled ? 'on' : 'off'} without touching the other settings`, async ({
      workspaceApi,
    }) => {
      const before = await workspaceApi.current();

      const response = await test.step(`PATCH config.aiEnabled = ${aiEnabled}`, () =>
        workspaceApi.update({ config: { aiEnabled } }));

      await test.step('responds 200; only the AI switch changed', async () => {
        expect(response.status()).toBe(200);
        expect((await workspaceApi.current()).config).toEqual({ ...before.config, aiEnabled });
      });
    });
  }

  test('should reject an AI switch that is not true or false with 422', async ({ workspaceApi }) => {
    const before = (await workspaceApi.current()).config;

    const response = await test.step('PATCH config.aiEnabled = "on"', () =>
      workspaceApi.update({ config: { aiEnabled: 'on' as never } }));

    await test.step('responds 422, and the switch is unchanged', async () => {
      expect(response.status()).toBe(422);
      expect((await workspaceApi.current()).config).toEqual(before);
    });
  });
});
