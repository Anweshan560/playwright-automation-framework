/** Settings → Workspace → API Keys: the page's API keys and Webhooks tabs. */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { env } from '../config/env';
import { WEBHOOK_EVENT, type ApiKeyData, type WebhookData } from '../utils/testData';
import { sendTimed } from '../utils/timing';

// --- API keys ---------------------------------------------------------------------------------

export type ApiKeyPayload = { name?: string };

/** `key` is the secret itself. */
export type ApiKeyRecord = { id: string; name: string; key: string; lastUsedAt: string | null };

export function toApiKeyPayload(apiKey: ApiKeyData): ApiKeyPayload {
  return { name: apiKey.name };
}

export class ApiKeysApi extends ResourceApi<ApiKeyPayload, ApiKeyRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.apiKeys);
  }
}

// --- Webhooks ---------------------------------------------------------------------------------

/** The dialog's "Events to receive" are stored as `filterTypes`. */
export type WebhookPayload = { url?: string; description?: string; filterTypes?: string[] };

/** Ids come from Svix, the webhook service, e.g. "ep_3LRo…". */
export type WebhookRecord = Required<WebhookPayload> & { id: string; disabled: boolean };

export function toWebhookPayload(webhook: WebhookData): WebhookPayload {
  return { url: webhook.url, description: webhook.description, filterTypes: [WEBHOOK_EVENT] };
}

/** Webhook endpoints have no GET by id: use findRecord. DELETE answers 204. */
export class WebhooksApi extends ResourceApi<WebhookPayload, WebhookRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.webhookEndpoints);
  }

  /** The events a webhook can subscribe to. */
  async eventTypes(): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${env.apiUrl}${ENDPOINTS.webhookEventTypes}`, { headers }));
  }

  /** The secret that signs the webhook's requests, answered as `{ key }`. */
  async signingSecret(id: string): Promise<APIResponse> {
    const headers = await this.headers();
    return sendTimed(() => this.request.get(`${this.url(id)}/secret`, { headers }));
  }
}
