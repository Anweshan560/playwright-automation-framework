import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { OUTCOME_ANSWERS, type OutcomeReasonData } from '../utils/testData';

/** "Show under" is stored as `answers`. Built-in reasons have a `key`; added ones have null. */
export type OutcomeReasonPayload = { label?: string; answers?: string[] };

export type OutcomeReasonRecord = Required<OutcomeReasonPayload> & { id: string; key: string | null };

export function toOutcomeReasonPayload(reason: OutcomeReasonData): OutcomeReasonPayload {
  return { label: reason.label, answers: reason.showUnder.map((answer) => OUTCOME_ANSWERS[answer]) };
}

/** Outcome reasons have no GET by id: use findRecord. */
export class OutcomeReasonsApi extends ResourceApi<OutcomeReasonPayload, OutcomeReasonRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.outcomeReasons);
  }
}
