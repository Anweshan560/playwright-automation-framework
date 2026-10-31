import { test, expect } from '../../../fixtures/test';
import { toInvitePayload } from '../../../api/MembersApi';
import { env } from '../../../config/env';
import { buildInvitee } from '../../../utils/testData';

// Invitations go to @example.com, so nobody receives an email, and every test revokes its own.
test.describe('Members API', { tag: ['@settings', '@members'] }, () => {
  test('should invite a user and list them as pending', async ({ membersApi, workspaceId, cleanup }) => {
    const payload = toInvitePayload(buildInvitee(), workspaceId);

    const response = await test.step('POST an invitation', () => membersApi.invite(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`invitation for ${payload.email}`, () => membersApi.revokeIfPending(body.data.id));

    await test.step('responds 201 with a pending invitation for the chosen role', () => {
      expect(response.status()).toBe(201);
      expect(body.data).toMatchObject({ id: expect.any(String), role: payload.role, status: 'pending' });
    });
    await test.step('the invitation expires in the future', () => {
      expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
    await test.step('the user list contains them as pending, with the chosen workspace role', async () => {
      const user = await membersApi.findUser(payload.email!);
      expect(user).toMatchObject({
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        status: 'pending',
        invitationId: body.data.id,
      });
      expect(user!.workspaces).toEqual([expect.objectContaining(payload.workspaces![0])]);
    });
  });

  test('should revoke an invitation so it leaves the user list', async ({
    membersApi,
    workspaceId,
    cleanup,
  }) => {
    const payload = toInvitePayload(buildInvitee(), workspaceId);
    const invitation = await test.step('invite a user', async () =>
      (await (await membersApi.invite(payload)).json()).data);
    // Safety net only: does nothing if the test revoked it as expected.
    cleanup.add(`invitation for ${payload.email}`, () => membersApi.revokeIfPending(invitation.id));

    const response = await test.step('revoke the invitation', () =>
      membersApi.revokeInvitation(invitation.id));

    await test.step('responds 200 and marks the invitation rejected', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: invitation.id, status: 'rejected' });
    });
    await test.step('the user list no longer contains them', async () => {
      expect(await membersApi.findUser(payload.email!)).toBeUndefined();
    });
  });

  test('should reject an invitation with missing fields with 422', async ({ membersApi }) => {
    const response = await test.step('POST an empty invitation', () => membersApi.invite({}));

    await test.step('responds 422 naming every missing field', async () => {
      expect(response.status()).toBe(422);
      const { message } = await response.json();
      expect(message).toMatchObject({
        firstName: 'firstName should not be empty',
        lastName: 'lastName should not be empty',
        email: 'email should not be empty',
        workspaces: 'workspaces should not be empty',
      });
      expect(message.role).toContain('role must be one of the following values');
    });
  });

  test('should reject an invalid email with 422 and invite nobody', async ({
    membersApi,
    workspaceId,
    cleanup,
  }) => {
    const payload = { ...toInvitePayload(buildInvitee(), workspaceId), email: 'not-an-email' };

    const response = await test.step('POST an invitation with email "not-an-email"', () =>
      membersApi.invite(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add('invitation for not-an-email', () => membersApi.revokeIfPending(body.data.id));

    await test.step('responds 422 "email must be an email"', () => {
      expect(response.status()).toBe(422);
      expect(body.message.email).toBe('email must be an email');
      expect(body.data).toBeUndefined();
    });
  });

  test('should reject an unknown organization role with 422', async ({
    membersApi,
    workspaceId,
    cleanup,
  }) => {
    const payload = { ...toInvitePayload(buildInvitee(), workspaceId), role: 'organization:owner' };

    const response = await test.step('POST an invitation with role "organization:owner"', () =>
      membersApi.invite(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`invitation for ${payload.email}`, () => membersApi.revokeIfPending(body.data.id));

    await test.step('responds 422 listing the allowed roles', () => {
      expect(response.status()).toBe(422);
      expect(body.message.role).toBe(
        'role must be one of the following values: organization:admin, organization:member',
      );
    });
  });

  test('should reject a request without a login token with 401', async ({ request, apiHeaders }) => {
    const { authorization: _omitted, ...headersWithoutToken } = await apiHeaders();

    const response = await test.step('GET the user list without a login token', () =>
      request.get(`${env.apiUrl}/v1/organizations/users`, { headers: headersWithoutToken }));

    await test.step('responds 401', () => expect(response.status()).toBe(401));
  });
});
