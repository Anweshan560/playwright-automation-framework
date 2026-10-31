import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import { ORGANIZATION_ROLES, WORKSPACE_ROLES, type Invitee } from '../utils/testData';
import { sendTimed } from '../utils/timing';

/** Request body for POST /v1/organizations/invite-user. */
export type InvitePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  /** "organization:admin" or "organization:member". */
  role?: string;
  /** The workspaces they can open, each with a role such as "workspace:agent". */
  workspaces?: { id: string; role: string }[];
};

/** An invitation as the API returns it. */
export type Invitation = {
  id: string;
  role: string;
  /** "pending" until accepted; "rejected" once revoked. */
  status: string;
  expiresAt: string;
};

/** A person in the organization's user list, including people who are only invited. */
export type OrganizationUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  /** "active", "pending" or "expired". */
  status: string;
  invitationId: string | null;
  workspaces: { id: string; name: string; role: string }[];
};

/** Convert dialog test data to the API's fields, giving access to `workspaceId`. */
export function toInvitePayload(invitee: Invitee, workspaceId: string): InvitePayload {
  return {
    firstName: invitee.firstName,
    lastName: invitee.lastName,
    email: invitee.email,
    role: ORGANIZATION_ROLES[invitee.organizationRole],
    workspaces: [{ id: workspaceId, role: WORKSPACE_ROLES[invitee.workspaceRole] }],
  };
}

/** Client for Settings → Organization → Members: the user list and invitations. */
export class MembersApi {
  private readonly url = `${env.apiUrl}/v1/organizations`;

  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
  ) {}

  /** GET everyone in the organization, including pending and expired invitations. */
  async listUsers(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${this.url}/users`, { headers }));
  }

  /** POST an invitation. */
  async invite(payload: InvitePayload): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.post(`${this.url}/invite-user`, { headers, data: payload }));
  }

  /** Revoke an invitation, so it can no longer be accepted. */
  async revokeInvitation(invitationId: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.patch(`${this.url}/invitations/${invitationId}/revoke`, { headers }));
  }

  /** The user list's entries. */
  async users(): Promise<OrganizationUser[]> {
    return (await (await this.listUsers()).json()).data;
  }

  /** The user-list entry for `email`, or undefined. */
  async findUser(email: string): Promise<OrganizationUser | undefined> {
    return (await this.users()).find((user) => user.email === email);
  }

  /** Revoke during cleanup. Passes if it was revoked now or was already gone. */
  async revokeIfPending(invitationId: string): Promise<void> {
    const response = await this.revokeInvitation(invitationId);
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`Revoking invitation ${invitationId} returned ${response.status()}`);
    }
  }
}
