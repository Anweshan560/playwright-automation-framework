import { test, expect } from '../../../fixtures/test';
import { ORGANIZATION_ROLES, WORKSPACE_ROLES, buildInvitee } from '../../../utils/testData';
import { recordApiCalls } from '../../../utils/network';

// Invitations go to @example.com, a domain reserved for testing, so nobody receives an email.
// Every test revokes the invitations it sends.
test.describe('Settings → Organization → Members', { tag: ['@settings', '@members'] }, () => {
  test('should open Members from the Settings menu', async ({ page, membersPage }) => {
    await test.step('go to Settings → Organization → Members', () => membersPage.openFromDashboard());
    await test.step('the user list is shown', async () => {
      await expect(page).toHaveURL('/settings/users');
      await expect(membersPage.usersTable).toBeVisible();
    });
  });

  test('should send an invitation and list the invited user as pending', async ({
    membersPage,
    membersApi,
    workspaceId,
    cleanup,
  }) => {
    const invitee = buildInvitee();

    await test.step('go to Settings → Organization → Members', () => membersPage.openFromDashboard());
    await test.step('open the Invite user dialog', () => membersPage.openInviteDialog());
    await test.step('fill in name, email, organization role and workspace role', () =>
      membersPage.inviteDialog.fill(invitee));
    const invitationId = await test.step('send the invite', () => membersPage.sendInvite());
    cleanup.add(`invitation for ${invitee.email}`, () => membersApi.revokeIfPending(invitationId));

    await test.step('the dialog closes and confirms the invitation was sent', async () => {
      await expect(membersPage.inviteDialog.root).toBeHidden();
      await expect(membersPage.invitationSentMessage(invitee.email)).toBeVisible();
    });
    await test.step('the user list shows the invited user as a pending Org Member', async () => {
      const row = membersPage.rowFor(invitee.email);
      await expect(row).toBeVisible();
      await expect(row).toContainText(`${invitee.firstName} ${invitee.lastName}`);
      await expect(row).toContainText(invitee.organizationRole);
      await expect(row).toContainText('Pending');
    });
    await test.step('the server stored the invitation with the chosen roles', async () => {
      const user = await membersApi.findUser(invitee.email);
      expect(user).toMatchObject({
        firstName: invitee.firstName,
        lastName: invitee.lastName,
        role: ORGANIZATION_ROLES[invitee.organizationRole],
        status: 'pending',
        invitationId,
      });
      expect(user!.workspaces).toEqual([
        expect.objectContaining({ id: workspaceId, role: WORKSPACE_ROLES[invitee.workspaceRole] }),
      ]);
    });
  });

  test('should not send an invitation when the required fields are empty', async ({ page, membersPage }) => {
    const inviteCalls = recordApiCalls(page, 'POST', '/v1/organizations/invite-user');

    await test.step('open the Invite user dialog', async () => {
      await membersPage.open();
      await membersPage.openInviteDialog();
    });
    await test.step('press Send invite without filling anything in', () =>
      membersPage.inviteDialog.sendInviteButton.click());
    await test.step('each required field says what is missing and the dialog stays open', async () => {
      await expect(membersPage.inviteDialog.error('Enter their first name')).toBeVisible();
      await expect(membersPage.inviteDialog.error('Enter their last name')).toBeVisible();
      await expect(membersPage.inviteDialog.error('Enter their email')).toBeVisible();
      await expect(membersPage.inviteDialog.root).toBeVisible();
    });
    await test.step('nothing is sent to the server', () => {
      expect(inviteCalls, 'no invite request should be sent').toEqual([]);
    });
  });

  test('should not send an invitation to an invalid email address', async ({ page, membersPage }) => {
    const inviteCalls = recordApiCalls(page, 'POST', '/v1/organizations/invite-user');
    const invitee = { ...buildInvitee(), email: 'not-an-email' };

    await test.step('open the Invite user dialog', async () => {
      await membersPage.open();
      await membersPage.openInviteDialog();
    });
    await test.step('fill in every field with an invalid email and send', async () => {
      await membersPage.inviteDialog.fill(invitee);
      await membersPage.inviteDialog.sendInviteButton.click();
    });
    await test.step('the browser rejects the email and the dialog stays open', async () => {
      // The field is type="email", so on a first attempt the browser itself blocks the send with
      // its own tooltip, which is not part of the page. Check the field's validity instead.
      const isNotAnEmail = await membersPage.inviteDialog.emailInput.evaluate(
        (input: HTMLInputElement) => input.validity.typeMismatch,
      );
      expect(isNotAnEmail, 'the browser should flag the email as invalid').toBe(true);
      await expect(membersPage.inviteDialog.root).toBeVisible();
    });
    await test.step('nothing is sent to the server', () => {
      expect(inviteCalls, 'no invite request should be sent').toEqual([]);
    });
  });
});
