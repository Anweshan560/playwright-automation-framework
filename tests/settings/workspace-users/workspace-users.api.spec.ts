import { test, expect } from '../../../fixtures/test';
import { env } from '../../../config/env';
import { buildWorkspaceInvitee } from '../../../utils/testData';

// Everyone added is on example.com, and every test revokes what it adds.
test.describe('Workspace users API', { tag: ['@settings', '@workspace-users'] }, () => {
  test("should list the workspace's users with their roles and status", async ({ workspaceUsersApi }) => {
    const response = await test.step('GET the users', () => workspaceUsersApi.list());

    await test.step('responds 200; every user has an email, a role and a status', async () => {
      expect(response.status()).toBe(200);
      const users = (await response.json()).data;
      expect(users.length).toBeGreaterThan(0);
      for (const user of users) {
        expect(user).toMatchObject({
          email: expect.any(String),
          roleId: expect.any(String),
          status: expect.stringMatching(/^(active|pending)$/),
        });
      }
    });
  });

  test('should add a user as a pending invitation with the chosen role', async ({
    workspaceUsersApi,
    cleanup,
  }) => {
    const user = buildWorkspaceInvitee();

    const response = await test.step('POST a user with the Marketing role', () =>
      workspaceUsersApi.add({ ...user, roleId: 'workspace:marketing' }));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(body.data.id));

    await test.step('responds 201 with a pending invitation that expires in the future', () => {
      expect(response.status()).toBe(201);
      expect(body.data).toMatchObject({ id: expect.any(String), status: 'pending' });
      expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
    await test.step('the user list has them pending, as Marketing', async () => {
      expect(await workspaceUsersApi.findUser(user.email)).toMatchObject({
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: 'workspace:marketing',
        status: 'pending',
        invitationId: body.data.id,
      });
    });
  });

  test('should take the user off the list when the invitation is revoked', async ({
    workspaceUsersApi,
    cleanup,
  }) => {
    const user = buildWorkspaceInvitee();
    const invitationId = await test.step('add a user', () =>
      workspaceUsersApi.addForSetup({ ...user, roleId: 'workspace:agent' }));
    cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(invitationId));

    const response = await test.step('revoke the invitation', () => workspaceUsersApi.revoke(invitationId));

    await test.step('responds 200 with the invitation rejected, and the user is gone', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: invitationId, status: 'rejected' });
      expect(await workspaceUsersApi.findUser(user.email)).toBeUndefined();
    });
  });

  test('should reject an empty user with 422 naming every missing field', async ({
    workspaceUsersApi,
    cleanup,
  }) => {
    const response = await test.step('POST an empty body', () => workspaceUsersApi.add({}));
    const body = await response.json();
    if (body.data?.id) cleanup.add('invitation', () => workspaceUsersApi.revokeIfPending(body.data.id));

    await test.step('responds 422 for first name, last name, email and role', () => {
      expect(response.status()).toBe(422);
      expect(body.message).toMatchObject({
        firstName: 'firstName should not be empty',
        lastName: 'lastName should not be empty',
        email: 'email should not be empty',
      });
      expect(body.message.role).toContain('role must be one of the following values');
    });
  });

  test('should reject a role that does not exist', async ({ workspaceUsersApi, cleanup }) => {
    const user = buildWorkspaceInvitee();

    const response = await test.step('POST a user with an unknown role', () =>
      workspaceUsersApi.add({ ...user, roleId: '00000000-0000-0000-0000-000000000000' }));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`invitation for ${user.email}`, () => workspaceUsersApi.revokeIfPending(body.data.id));

    await test.step('responds 4xx and nobody is added', async () => {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      expect(await workspaceUsersApi.findUser(user.email)).toBeUndefined();
    });
  });

  test('should reject a request without a login token with 401', async ({
    request,
    workspaceUsersApi,
    apiHeaders,
  }) => {
    const { authorization: _omitted, ...headersWithoutToken } = await apiHeaders();

    const response = await test.step('GET the users without a login token', () =>
      request.get(`${env.apiUrl}${workspaceUsersApi.path}`, { headers: headersWithoutToken }));

    await test.step('responds 401', () => expect(response.status()).toBe(401));
  });
});
