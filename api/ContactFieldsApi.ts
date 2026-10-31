import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { CONTACT_FIELD_TYPES, type ContactFieldData } from '../utils/testData';
import { sendTimed } from '../utils/timing';

/** The dialog's Name is `label`, Options are `values` and "Show this field on contacts" is `isVisible`. */
export type ContactFieldPayload = {
  key?: string;
  label?: string;
  type?: string;
  values?: string[];
  placeholder?: string;
  isVisible?: boolean;
};

export type ContactFieldRecord = Required<ContactFieldPayload> & { id: string; deletedAt: string | null };

export function toContactFieldPayload(field: ContactFieldData): ContactFieldPayload {
  return {
    key: field.key,
    label: field.name,
    type: CONTACT_FIELD_TYPES[field.type],
    values: field.options,
    placeholder: field.placeholder,
    isVisible: field.showOnContacts,
  };
}

/**
 * Contact fields have no GET by id (use findRecord). DELETE only archives a field: it moves to
 * `/archived`, from where it can be restored or deleted permanently.
 */
export class ContactFieldsApi extends ResourceApi<ContactFieldPayload, ContactFieldRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.contactFields);
  }

  /** Archive a field (the API's DELETE). */
  archive(id: string): Promise<APIResponse> {
    return this.delete(id);
  }

  async listArchived(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${this.url()}/archived`, { headers }));
  }

  async listArchivedRecords(): Promise<ContactFieldRecord[]> {
    return (await (await this.listArchived()).json()).data;
  }

  async restore(id: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.post(`${this.url(id)}/restore`, { headers }));
  }

  /** Only archived fields can be deleted permanently; active ones answer 400. */
  async deletePermanently(id: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.delete(`${this.url(id)}/permanent`, { headers }));
  }

  /** Cleanup: archive the field if it is still active, then delete it permanently. */
  override async deleteIfExists(id: string): Promise<void> {
    // Fails harmlessly when the field is already archived or gone; either way, purge next.
    await this.archive(id);
    const response = await this.deletePermanently(id);
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`DELETE ${this.path}/${id}/permanent returned ${response.status()}`);
    }
  }
}
