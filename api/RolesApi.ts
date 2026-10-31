/**
 * Settings → Workspace → Roles and Members (the workspace's users). Tests only ever change roles
 * and invitations they created: the built-in roles and the real teammates are never touched.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ResourceApi, type HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import { sendTimed } from '../utils/timing';
import { CONTACT_VISIBILITY, type RoleData } from '../utils/testData';

// --- Roles ------------------------------------------------------------------------------------

/** A role. `base` is the built-in role it extends: custom roles build on Member or Agent. */
export type RolePayload = {
  name?: string;
  description?: string;
  base?: 'workspace:member' | 'workspace:agent';
  contactVisibility?: 'all' | 'teams' | 'assigned';
  permissions?: string[];
};

export type RoleRecord = Required<RolePayload> & {
  id: string;
  isSystem: boolean;
  memberCount: number;
};

/** The built-in roles' ids, e.g. "workspace:agent". */
export const BUILT_IN_ROLE_IDS = {
  Admin: 'workspace:admin',
  Member: 'workspace:member',
  Agent: 'workspace:agent',
  Marketing: 'workspace:marketing',
  Finance: 'workspace:finance',
} as const;

/**
 * A role as the editor would save it: the permissions of the role it starts from, plus the extras.
 * @param startingPermissions the permissions of `role.startFrom` (see RolesApi.builtIn)
 */
export function toRolePayload(role: RoleData, startingPermissions: string[]): RolePayload {
  return {
    name: role.name,
    description: role.description,
    base: BUILT_IN_ROLE_IDS[role.startFrom],
    contactVisibility: CONTACT_VISIBILITY[role.contactVisibility],
    permissions: [...new Set([...startingPermissions, ...role.extraPermissions.map((p) => p.key)])],
  };
}

/** `/v1/workspaces/<id>/roles`. There is no GET by id: use findRecord. */
export class RolesApi extends ResourceApi<RolePayload, RoleRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider, workspaceId: string) {
    super(request, headers, `/v1/workspaces/${workspaceId}/roles`);
  }

  /** Every permission, and which other permissions each one needs. */
  async catalog(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${this.url()}/catalog`, { headers }));
  }

  /** A built-in role, e.g. "Agent". Throws if the workspace doesn't have it. */
  async builtIn(name: keyof typeof BUILT_IN_ROLE_IDS): Promise<RoleRecord> {
    const role = await this.findRecord(BUILT_IN_ROLE_IDS[name]);
    if (!role) throw new Error(`The workspace has no built-in ${name} role`);
    return role;
  }
}

// --- Workspace users --------------------------------------------------------------------------

/** "Add user": invites someone to this workspace with a role. */
export type WorkspaceUserPayload = { firstName?: string; lastName?: string; email?: string; roleId?: string };

export type WorkspaceUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** The role's id; for a custom role, `role` is its base. */
  roleId: string;
  role: string;
  status: 'active' | 'pending';
  invitationId: string | null;
};

/** `/v1/workspaces/<id>/users`: who is in the workspace, and invitations to it. */
export class WorkspaceUsersApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
    private readonly workspaceId: string,
  ) {}

  get path(): string {
    return `/v1/workspaces/${this.workspaceId}/users`;
  }

  async list(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${env.apiUrl}${this.path}`, { headers }));
  }

  /** Invite someone; answers 201 with the pending invitation. */
  async add(payload: WorkspaceUserPayload): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.post(`${env.apiUrl}${this.path}`, { headers, data: payload }));
  }

  async users(): Promise<WorkspaceUser[]> {
    const response = await this.list();
    if (!response.ok()) throw new Error(`GET ${this.path} returned ${response.status()}`);
    return (await response.json()).data;
  }

  async findUser(email: string): Promise<WorkspaceUser | undefined> {
    return (await this.users()).find((user) => user.email === email);
  }

  /** Invite someone for test setup. Throws unless the API answers 201. @returns the invitation id. */
  async addForSetup(payload: WorkspaceUserPayload): Promise<string> {
    const response = await this.add(payload);
    if (response.status() !== 201) {
      throw new Error(
        `Setup failed: POST ${this.path} returned ${response.status()}: ${await response.text()}`,
      );
    }
    return (await response.json()).data.id;
  }

  /** Revoke an invitation (it then leaves the workspace's users). */
  async revoke(invitationId: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() =>
      this.request.patch(`${env.apiUrl}/v1/organizations/invitations/${invitationId}/revoke`, { headers }),
    );
  }

  /** Revoke during cleanup. Passes if it was revoked now or was already gone. */
  async revokeIfPending(invitationId: string): Promise<void> {
    const response = await this.revoke(invitationId);
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`Revoking invitation ${invitationId} returned ${response.status()}`);
    }
  }
}
