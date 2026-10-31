/**
 * The workspace's own settings: Settings → Workspace → General, Inbox → Hours, SLAs and Assignment,
 * and AI → General. Each is a single record per workspace, so every client can remember the current
 * state and put it back after a test.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import { sendTimed } from '../utils/timing';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Times are "HH:MM", 24-hour. A day with no ranges is closed. */
export type TimeRange = { start: string; end: string };
export type WeeklyHours = Record<Weekday, TimeRange[]>;
export type OffDay = { date: string; reason: string };

/** The settings stored in `config`; only those the tests change. */
export type WorkspaceConfig = { followUpCreditWindowDays?: number; aiEnabled?: boolean };

export type WorkspacePayload = {
  name?: string;
  config?: WorkspaceConfig;
  workingHours?: Partial<WeeklyHours> | null;
  offDays?: OffDay[];
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  config: WorkspaceConfig;
  workingHours: WeeklyHours | null;
  /** The date the current working hours apply from ("-infinity" for the first version). */
  workingHoursEffectiveFrom: string | null;
  offDays: OffDay[];
};

/** Working hours open `start`–`end` on Monday to Friday, closed at the weekend. */
export function weekdayHours(start: string, end: string): WeeklyHours {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, day === 'saturday' || day === 'sunday' ? [] : [{ start, end }]]),
  ) as WeeklyHours;
}

/** GET and PATCH one workspace: `/v1/workspaces/<id>`. */
export class WorkspaceApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
    private readonly workspaceId: string,
  ) {}

  get path(): string {
    return `/v1/workspaces/${this.workspaceId}`;
  }

  async get(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${env.apiUrl}${this.path}`, { headers }));
  }

  /** PATCH the workspace. `config` is merged into the stored one, key by key. */
  async update(payload: WorkspacePayload): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.patch(`${env.apiUrl}${this.path}`, { headers, data: payload }));
  }

  /** The workspace as it is now. Throws unless the API answers 200. */
  async current(): Promise<WorkspaceRecord> {
    const response = await this.get();
    if (!response.ok()) throw new Error(`GET ${this.path} returned ${response.status()}`);
    return (await response.json()).data;
  }

  /**
   * Remember the workspace's name, config, working hours and off days.
   * @returns a function that puts them back. Throws if the API refuses.
   */
  async rememberCurrent(): Promise<() => Promise<void>> {
    const { name, config, workingHours, offDays } = await this.current();
    return async () => {
      const response = await this.update({ name, config, workingHours, offDays });
      if (!response.ok()) throw new Error(`Restoring the workspace failed: ${response.status()}`);
    };
  }
}

// --- SLAs -------------------------------------------------------------------------------------

/** The six clocks, in the page's tab order. */
export const SLA_CLOCKS = [
  'first_reply',
  'subsequent_reply',
  'open_conversation',
  'follow_up_overdue',
  'ai_waiting',
  'unassigned',
] as const;

export type SlaClock = {
  clock: (typeof SLA_CLOCKS)[number];
  enabled: boolean;
  durationValue: number;
  durationUnit: 'minutes' | 'hours' | 'days';
  notifyOnReminder: boolean;
  reminderPercent: number;
  reminderAudience: string;
  reminderUserIds: string[];
  notifyOnBreach: boolean;
  breachAudience: string;
  breachUserIds: string[];
};

/** A clock as the page creates it: off, 1 hour, breach notice to the assignee, no reminder. */
export function defaultSlaClock(clock: SlaClock['clock']): SlaClock {
  return {
    clock,
    enabled: false,
    durationValue: 1,
    durationUnit: 'hours',
    notifyOnReminder: false,
    reminderPercent: 80,
    reminderAudience: 'assignee',
    reminderUserIds: [],
    notifyOnBreach: true,
    breachAudience: 'assignee',
    breachUserIds: [],
  };
}

/** `/v1/workspaces/<id>/slas`: the page saves all six clocks at once with PUT. */
export class SlasApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
    private readonly workspaceId: string,
  ) {}

  get path(): string {
    return `/v1/workspaces/${this.workspaceId}/slas`;
  }

  async list(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${env.apiUrl}${this.path}`, { headers }));
  }

  /** Replace every clock. */
  async save(clocks: SlaClock[]): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.put(`${env.apiUrl}${this.path}`, { headers, data: { clocks } }));
  }

  /** The stored clocks; before the page is first saved there are none. */
  async clocks(): Promise<SlaClock[]> {
    const response = await this.list();
    if (!response.ok()) throw new Error(`GET ${this.path} returned ${response.status()}`);
    return (await response.json()).data;
  }

  /**
   * Remember the clocks as they are now.
   * @returns a function that puts them back. The API can't go back to "no clocks", so a workspace
   * that had none gets all six switched off, which times nothing, the same as none.
   */
  async rememberCurrent(): Promise<() => Promise<void>> {
    const original = await this.clocks();
    return async () => {
      const clocks = original.length ? original : SLA_CLOCKS.map(defaultSlaClock);
      const response = await this.save(clocks.map(toSlaClock));
      if (!response.ok()) throw new Error(`Restoring the SLAs failed: ${response.status()}`);
    };
  }
}

/** Only the fields the API accepts back (it answers with `durationSeconds` too). */
export function toSlaClock(clock: SlaClock): SlaClock {
  const { durationSeconds: _computed, ...fields } = clock as SlaClock & { durationSeconds?: number };
  return fields;
}

// --- Assignment -------------------------------------------------------------------------------

export type AssignmentSettings = { requireTeamOnAssign: boolean; reassignToReplier: boolean };

/** `/v1/workspace-assignments`: the current workspace's assignment rules. */
export class AssignmentApi {
  readonly path = '/v1/workspace-assignments';

  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
  ) {}

  async get(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${env.apiUrl}${this.path}`, { headers }));
  }

  async update(payload: Partial<AssignmentSettings>): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.patch(`${env.apiUrl}${this.path}`, { headers, data: payload }));
  }

  async current(): Promise<AssignmentSettings> {
    const response = await this.get();
    if (!response.ok()) throw new Error(`GET ${this.path} returned ${response.status()}`);
    return (await response.json()).data;
  }

  /** @returns a function that puts the current rules back. */
  async rememberCurrent(): Promise<() => Promise<void>> {
    const original = await this.current();
    return async () => {
      const response = await this.update(original);
      if (!response.ok()) throw new Error(`Restoring the assignment rules failed: ${response.status()}`);
    };
  }
}
