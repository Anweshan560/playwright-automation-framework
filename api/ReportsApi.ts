/**
 * Reports and the dashboard: read-only endpoints under `/v1/reports`, each answering for a date
 * range (`startDate`/`endDate`, ISO 8601).
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import { sendTimed } from '../utils/timing';

export type DateRange = { start: Date; end: Date };

/** A day either side of now: whatever the workspace's time zone, it includes anything made now. */
export function aroundNow(): DateRange {
  const day = 24 * 3600 * 1000;
  return { start: new Date(Date.now() - day), end: new Date(Date.now() + day) };
}

/** From a day ago until a day after `day`: includes now, and anything booked on `day`. */
export function untilAfter(day: Date): DateRange {
  const oneDay = 24 * 3600 * 1000;
  return { start: new Date(Date.now() - oneDay), end: new Date(day.getTime() + oneDay) };
}

export type ContactsSummary = {
  total: number;
  createdInRange: number;
  firstStage: { total: number; createdInRange: number };
};

export type AppointmentsSummary = {
  scheduled: { value: number };
  attended: { value: number };
  noShows: { value: number };
  cancelled: number;
};

export type DashboardClinic = {
  money: {
    collected: { amount: number };
    advances: { amount: number; count: number };
    direct: { amount: number };
  };
  appointments: { scheduled: number; attended: number; noShows: number; cancelled: number };
  leads: { newLeads: number; booked: number; paying: number };
};

export class ReportsApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
  ) {}

  /** GET a report, e.g. "contacts/summary", for `range`, with any extra query parameters. */
  async get(report: string, range?: DateRange, params: Record<string, string> = {}): Promise<APIResponse> {
    const headers = await this.headers();
    const dates: Record<string, string> = range
      ? { startDate: range.start.toISOString(), endDate: range.end.toISOString() }
      : {};
    return sendTimed(() =>
      this.request.get(`${env.apiUrl}/v1/reports/${report}`, { headers, params: { ...dates, ...params } }),
    );
  }

  async contactsSummary(range: DateRange): Promise<ContactsSummary> {
    return this.data('contacts/summary', range);
  }

  async appointmentsSummary(range: DateRange): Promise<AppointmentsSummary> {
    return this.data('appointments/summary', range, { basis: 'scheduled' });
  }

  async dashboardClinic(range: DateRange): Promise<DashboardClinic> {
    return this.data('dashboard/clinic', range);
  }

  /** A report's `data`. Throws unless the API answers 200. */
  private async data<T>(report: string, range: DateRange, params: Record<string, string> = {}): Promise<T> {
    const response = await this.get(report, range, params);
    if (!response.ok()) throw new Error(`GET /v1/reports/${report} returned ${response.status()}`);
    return (await response.json()).data;
  }
}
