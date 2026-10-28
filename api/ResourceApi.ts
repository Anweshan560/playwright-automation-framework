import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';
import { sendTimed } from '../utils/timing';

/** Paths of the app's API endpoints, relative to `env.apiUrl`. */
export const ENDPOINTS = {
  departments: '/v1/clinics/departments',
  doctors: '/v1/clinics/doctors',
  treatments: '/v1/clinics/treatments',
} as const;

/** Returns the auth + workspace headers. Called per request because login tokens last only 60s. */
export type HeadersProvider = () => Promise<Record<string, string>>;

/**
 * List / get / create / delete for one REST resource of the app's API.
 * The plain methods return the raw response, so tests can check status codes, including errors,
 * and response times through responseTimeMs().
 * The `...Record` helpers are for test setup and cleanup, and throw if the API misbehaves.
 */
export class ResourceApi<TPayload extends object, TRecord extends { id: string }> {
  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
    private readonly path: string,
  ) {}

  /** GET the whole list. */
  async list(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(this.url(), { headers }));
  }

  /** GET one record by id. */
  async get(id: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(this.url(id), { headers }));
  }

  /** POST a new record. */
  async create(payload: TPayload): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.post(this.url(), { headers, data: payload }));
  }

  /** DELETE a record by id. */
  async delete(id: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.delete(this.url(id), { headers }));
  }

  /** The records in the list response. */
  async listRecords(): Promise<TRecord[]> {
    const response = await this.list();
    return (await response.json()).data;
  }

  /** Create a record for test setup and return it. Throws unless the API answers 201. */
  async createRecord(payload: TPayload): Promise<TRecord> {
    const response = await this.create(payload);
    if (response.status() !== 201) {
      throw new Error(
        `Setup failed: POST ${this.path} returned ${response.status()}: ${await response.text()}`,
      );
    }
    return (await response.json()).data;
  }

  /** Delete a record during cleanup. Passes if it was deleted now or was already gone. */
  async deleteIfExists(id: string): Promise<void> {
    const response = await this.delete(id);
    if (response.status() !== 200 && response.status() !== 404) {
      throw new Error(`DELETE ${this.path}/${id} returned ${response.status()}`);
    }
  }

  private url(id?: string): string {
    return `${env.apiUrl}${this.path}${id ? `/${id}` : ''}`;
  }
}
