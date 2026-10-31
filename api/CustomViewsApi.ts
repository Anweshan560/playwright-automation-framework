import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { VIEW_FIELDS, VIEW_OPERATORS, type SavedViewData } from '../utils/testData';

export type ViewRulePayload = { field: string; operator: string; value: string };

/** "Share" is stored as `visibility`: "Just me" is private, "Everyone" is workspace. */
export type CustomViewPayload = {
  name?: string;
  icon?: string;
  visibility?: 'private' | 'workspace';
  query?: { rules: ViewRulePayload[] };
};

export type CustomViewRecord = Required<CustomViewPayload> & { id: string };

export function toCustomViewPayload(view: SavedViewData): CustomViewPayload {
  return {
    name: view.name,
    icon: view.icon.emoji,
    visibility: view.share === 'Everyone' ? 'workspace' : 'private',
    query: {
      rules: [
        {
          field: VIEW_FIELDS[view.rule.field],
          operator: VIEW_OPERATORS[view.rule.operator],
          value: view.rule.value,
        },
      ],
    },
  };
}

/** Inbox saved views. They update with PUT. */
export class CustomViewsApi extends ResourceApi<CustomViewPayload, CustomViewRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.customViews, 'PUT');
  }
}
