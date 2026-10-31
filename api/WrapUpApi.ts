import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { WRAP_UP_RESULTS, type WrapUpOutcomeData } from '../utils/testData';

/** One step of an outcome; the tests only use "Close conversation". */
export type WrapUpStepPayload = {
  id?: string;
  type: string;
  config: { closingNoteIds: string[] };
  isAutomated: boolean;
};

/** One outcome. The page's Result is stored as `category`. */
export type WrapUpOutcomePayload = {
  id?: string;
  name: string;
  category: string;
  description: string;
  steps: WrapUpStepPayload[];
};

/** The workspace's wrap-up: its outcomes are the `config` list. */
export type WrapUpPayload = { name?: string; description?: string | null; config?: WrapUpOutcomePayload[] };

export type WrapUpRecord = Required<WrapUpPayload> & { id: string };

/** The page saves its wrap-up under this name. */
export const WRAP_UP_NAME = 'Conversation wrap-up';

/**
 * An outcome whose single step closes the conversation with `closingNoteId`. Like the page, it gives
 * the outcome and step their own ids: the page can't save outcomes without them (see wrap-up.spec.ts).
 */
export function toWrapUpOutcomePayload(
  outcome: WrapUpOutcomeData,
  closingNoteId: string,
  { withIds = true } = {},
): WrapUpOutcomePayload {
  const step: WrapUpStepPayload = {
    type: 'close_conversation',
    config: { closingNoteIds: [closingNoteId] },
    isAutomated: false,
  };
  return {
    ...(withIds ? { id: randomUUID() } : {}),
    name: outcome.name,
    category: WRAP_UP_RESULTS[outcome.result],
    description: outcome.description,
    steps: [withIds ? { id: randomUUID(), ...step } : step],
  };
}

export function toWrapUpPayload(outcomes: WrapUpOutcomePayload[]): WrapUpPayload {
  return { name: WRAP_UP_NAME, config: outcomes };
}

/**
 * The page edits one wrap-up per workspace, so tests that change it run one at a time
 * (the `workspace-settings` project) and put it back afterwards with rememberCurrent().
 */
export class WrapUpApi extends ResourceApi<WrapUpPayload, WrapUpRecord> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.wrapUp);
  }

  /**
   * Add an outcome to the workspace's wrap-up, as the page would save it: to the first wrap-up
   * if there is one, else to a new one. Throws unless the API accepts it.
   */
  async addOutcome(outcome: WrapUpOutcomePayload): Promise<void> {
    const [current] = await this.listRecords();
    const response = current
      ? await this.update(current.id, { config: [...current.config, outcome] })
      : await this.create(toWrapUpPayload([outcome]));
    if (!response.ok()) {
      throw new Error(
        `Setup failed: saving the wrap-up returned ${response.status()}: ${await response.text()}`,
      );
    }
  }

  /** Every outcome of every wrap-up in the workspace. */
  async listOutcomes(): Promise<WrapUpOutcomePayload[]> {
    return (await this.listRecords()).flatMap((record) => record.config);
  }

  /**
   * Remember the workspace's wrap-ups as they are now.
   * @returns a function that puts them back: it deletes wrap-ups added since and restores the
   * outcomes of the ones that were there.
   */
  async rememberCurrent(): Promise<() => Promise<void>> {
    const original = await this.listRecords();
    return async () => {
      for (const record of await this.listRecords()) {
        const before = original.find((item) => item.id === record.id);
        if (!before) await this.deleteIfExists(record.id);
        else await this.update(record.id, { name: before.name, config: before.config });
      }
    };
  }
}
