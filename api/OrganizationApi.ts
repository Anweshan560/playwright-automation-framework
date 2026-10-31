import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import type { OrganizationProfile } from '../utils/testData';
import { sendTimed } from '../utils/timing';

/** Request body for PATCH /v1/organizations/:id (only the fields Organization → General edits). */
export type OrganizationPayload = {
  name?: string;
  website?: string;
  /** With country code, e.g. "+9779812345678". */
  phoneNumber?: string;
  /** The Country field, as a two-letter code, e.g. "NP". */
  region?: string;
  /** An IANA timezone, e.g. "Asia/Kathmandu". */
  timezone?: string;
  /** "clinic" or "ecommerce". */
  type?: string;
};

/** The organization as the API returns it (only the fields the tests use). */
export type Organization = Required<OrganizationPayload> & {
  id: string;
  currency: string;
  slug: string;
};

/** The phone country code of the test account. The tests change the number, not the country code. */
const PHONE_COUNTRY_CODE = '+977';

/** Convert the form's values to the API's field names. */
export function toOrganizationPayload(profile: OrganizationProfile): OrganizationPayload {
  return {
    name: profile.name,
    website: profile.website,
    phoneNumber: `${PHONE_COUNTRY_CODE}${profile.phoneDigits}`,
    region: profile.country.code,
    timezone: profile.timezone.id,
    type: profile.type.value,
  };
}

/** The editable fields of `organization`, to put them back after a test changed them. */
export function editableFields(organization: Organization): OrganizationPayload {
  const { name, website, phoneNumber, region, timezone, type } = organization;
  return { name, website, phoneNumber, region, timezone, type };
}

/** Client for the logged-in user's organization. */
export class OrganizationApi {
  private readonly url = `${env.apiUrl}/v1/organizations`;

  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: HeadersProvider,
  ) {}

  /** GET the current organization. */
  async get(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(this.url, { headers }));
  }

  /** PATCH the organization. */
  async update(id: string, payload: OrganizationPayload): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.patch(`${this.url}/${id}`, { headers, data: payload }));
  }

  /** The current organization. Throws unless the API answers 200. */
  async current(): Promise<Organization> {
    const response = await this.get();
    if (!response.ok()) throw new Error(`GET /v1/organizations returned ${response.status()}`);
    return (await response.json()).data;
  }

  /** Put back the fields a test changed. Throws if the API refuses. */
  async restore(original: Organization): Promise<void> {
    const response = await this.update(original.id, editableFields(original));
    if (!response.ok()) throw new Error(`Restoring the organization failed: ${response.status()}`);
  }
}
