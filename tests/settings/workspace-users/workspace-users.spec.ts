import { test, expect } from '../../../fixtures/test';
import { toRolePayload } from '../../../api/RolesApi';
import { env } from '../../../config/env';
import { buildRole, buildWorkspaceInvitee } from '../../../utils/testData';

// Everyone added is on example.com, so no invitation email reaches anyone, and every test revokes
// what it adds. Real teammates are listed too, and are never touched.
test.describe('Settings → Workspace → Members', { tag: ['@settings', '@workspace-users'] }, () => {
  test("should open Members from the Settings menu with this workspace's users", async ({
    page,
    workspaceUsersPage,
  }) => {
    await test.step('go to Settings → Workspace → Members', () => workspaceUsersPage.openFromDashboard());
    await test.step('the page is about this workspace, and lists its users', async () => {
      await expect(page.getByRole('banner')).toContainText(`People in ${env.testWorkspace}`);
      await expect(workspaceUsersPage.table.getByRole('row')).not.toHaveCount(1);
    });
  });

  test('should add a user with a built-in role as a pending invitation', async ({
    workspaceUsersPage,
    workspaceUsersApi,
    cleanup,
  }) => {
    const user = buildWorkspaceInvitee();

    await test.step('open Members', () => workspaceUsersPage.open());
    await test.step('the Add user dialog adds to this workspace, as Member by default', async () => {
      await workspaceUsersPage.addUserButton.click();
      await expect(workspaceUsersPage.addUserDialog).toContainText(`Add a user to "${env.testWorkspace}"`);
      await expect(workspaceUsersPage.addUserDialog.getByRole('button', { name: / Role$/ })).toHaveText(
        'Member',
      );
      await workspaceUsersPage.addUserDialog.getByRole('button', { name: 'Cancel' }).click();
    });
    const invitationId = await test.step('add a user as Agent', () =>
      workspaceUsersPage.addUser(user, 'Agent'));
    cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(invitationId));

    await test.step('the list shows them as a pending Agent', async () => {
      const row = workspaceUsersPage.row(user.email);
      await expect(row).toContainText(`${user.firstName} ${user.lastName}`);
      await expect(row).toContainText('Agent');
      await expect(row).toContainText('Pending');
    });
    await test.step('the server has them pending, with the Agent role', async () => {
      expect(await workspaceUsersApi.findUser(user.email)).toMatchObject({
        status: 'pending',
        roleId: 'workspace:agent',
        invitationId,
      });
    });
  });

  test('should add a user with a custom role', async ({
    workspaceUsersPage,
    workspaceUsersApi,
    rolesApi,
    cleanup,
  }) => {
    const role = await test.step('create a custom role (through the API)', async () =>
      rolesApi.createRecord(toRolePayload(buildRole(), (await rolesApi.builtIn('Agent')).permissions)));
    cleanup.add(`role ${role.name}`, () => rolesApi.deleteIfExists(role.id));
    const user = buildWorkspaceInvitee();

    const invitationId = await test.step('add a user with that role', async () => {
      await workspaceUsersPage.open();
      return workspaceUsersPage.addUser(user, role.name);
    });
    // Registered after the role, so it runs first: the role can only go once nobody is invited with it.
    cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(invitationId));

    await test.step('the list and the server show the custom role', async () => {
      await expect(workspaceUsersPage.row(user.email)).toContainText(role.name);
      expect((await workspaceUsersApi.findUser(user.email))?.roleId).toBe(role.id);
    });
  });

  test('should offer Resend and Revoke for a pending invitation', async ({
    workspaceUsersPage,
    workspaceUsersApi,
    cleanup,
  }) => {
    const user = buildWorkspaceInvitee();
    const invitationId = await test.step('add a user (through the API)', () =>
      workspaceUsersApi.addForSetup({ ...user, roleId: 'workspace:agent' }));
    cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(invitationId));

    await test.step('their actions are Resend invitation and Revoke invitation', async () => {
      await workspaceUsersPage.open();
      expect(await workspaceUsersPage.actionsOf(user.email)).toEqual([
        'Resend invitation',
        'Revoke invitation',
      ]);
    });
  });

  test('should remove a pending user when user revokes the invitation', async ({
    workspaceUsersPage,
    workspaceUsersApi,
    cleanup,
  }) => {
    const user = buildWorkspaceInvitee();
    const invitationId = await test.step('add a user (through the API)', () =>
      workspaceUsersApi.addForSetup({ ...user, roleId: 'workspace:agent' }));
    // Safety net only: does nothing if the test revoked it as expected.
    cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(invitationId));

    await test.step('revoke their invitation', async () => {
      await workspaceUsersPage.open();
      await workspaceUsersPage.revokeInvitation(user.email);
    });
    await test.step('they are gone from the list and the server', async () => {
      await expect(workspaceUsersPage.row(user.email)).toHaveCount(0);
      expect(await workspaceUsersApi.findUser(user.email)).toBeUndefined();
    });
  });
});
