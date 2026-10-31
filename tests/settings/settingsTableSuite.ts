/**
 * The tests every Settings table page gets (Websites, Teams, Tags, Closing Notes, Snippets, Files).
 * Each page's spec files call these with its own config (see settingsTables.ts), so the steps are
 * written once and every page is tested the same way.
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test';
import type { HeadersProvider, ResourceApi } from '../../api/ResourceApi';
import { env } from '../../config/env';
import type { SettingsTablePage } from '../../pages/settings/SettingsTablePage';

/** What a page has to tell the shared tests. */
export type SettingsTableConfig<
  TData,
  TPayload extends Record<string, unknown>,
  TRecord extends { id: string },
> = {
  /** Page title, e.g. "Websites"; the singular is used in test names, e.g. "website". */
  title: string;
  singular: string;
  /** Tags for running this page on its own, e.g. ["@settings", "@websites"]. */
  tags: string[];
  createPage: (page: Page, workspaceId: string) => SettingsTablePage<TData>;
  createApi: (
    request: APIRequestContext,
    headers: HeadersProvider,
    workspaceId: string,
  ) => ResourceApi<TPayload, TRecord>;
  /** New test data; given the current record, every field must differ from it. */
  build: (current?: TData) => TData;
  toPayload: (data: TData) => TPayload;
  /**
   * The fields the server must store when the record is saved through the UI.
   * Defaults to toPayload; differs where the app adds data itself (e.g. an uploaded file's URL).
   */
  storedFields?: (data: TData) => Partial<TPayload>;
  /** What the delete confirmation must say about the record. */
  deleteConfirmation: (data: TData) => string | RegExp;
  /** The 422 messages for an empty create request, per field. */
  requiredFieldErrors: Record<string, string>;
  /** The 404 message for a record that doesn't exist. */
  notFoundMessage: string;
};

/** Declare a page's config; TypeScript works out its data, payload and record types. */
export function defineSettingsTable<
  TData,
  TPayload extends Record<string, unknown>,
  TRecord extends { id: string },
>(config: SettingsTableConfig<TData, TPayload, TRecord>): SettingsTableConfig<TData, TPayload, TRecord> {
  return config;
}

/** UI tests: open from the menu, then create, edit and delete through the dialogs. */
export function describeSettingsTableUi<
  TData,
  TPayload extends Record<string, unknown>,
  TRecord extends { id: string },
>(config: SettingsTableConfig<TData, TPayload, TRecord>): void {
  const stored = config.storedFields ?? config.toPayload;

  test.describe(`Settings → ${config.title}`, { tag: config.tags }, () => {
    test(`should open ${config.title} from the Settings menu`, async ({ page, workspaceId }) => {
      const settingsPage = config.createPage(page, workspaceId);

      await test.step(`go to Settings → ${config.title}`, () => settingsPage.openFromDashboard());
      await test.step('the list is shown', async () => {
        await expect(settingsPage.table).toBeVisible();
      });
    });

    test(`should save every field when user creates a ${config.singular}`, async ({
      page,
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const settingsPage = config.createPage(page, workspaceId);
      const api = config.createApi(request, apiHeaders, workspaceId);
      const data = config.build();

      await test.step(`go to Settings → ${config.title}`, () => settingsPage.openFromDashboard());
      const id = await test.step('fill in and save the create dialog', () => settingsPage.createRecord(data));
      cleanup.add(`${config.singular} ${id}`, () => api.deleteIfExists(id));

      await test.step('the new record appears in the list', async () => {
        await expect(settingsPage.rowFor(data)).toBeVisible();
      });
      await test.step('after a reload, the edit dialog shows every field as entered', () =>
        settingsPage.expectSavedValues(data));
      await test.step('the server stored every field', async () => {
        expect((await (await api.get(id)).json()).data).toMatchObject(stored(data));
      });
    });

    test(`should save every change when user edits a ${config.singular}`, async ({
      page,
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const settingsPage = config.createPage(page, workspaceId);
      const api = config.createApi(request, apiHeaders, workspaceId);
      const original = config.build();
      const existing = await test.step(`create a ${config.singular} to edit (through the API)`, () =>
        api.createRecord(config.toPayload(original)));
      cleanup.add(`${config.singular} ${existing.id}`, () => api.deleteIfExists(existing.id));
      const updated = config.build(original);

      await test.step('change every field and save', () => settingsPage.editRecord(original, updated));
      await test.step('the list shows the new record instead of the old one', async () => {
        await expect(settingsPage.rowFor(updated)).toBeVisible();
        await expect(settingsPage.rowFor(original)).toHaveCount(0);
      });
      await test.step('after a reload, the edit dialog shows every new value', () =>
        settingsPage.expectSavedValues(updated));
      await test.step('the server stored every new value', async () => {
        expect((await (await api.get(existing.id)).json()).data).toMatchObject(stored(updated));
      });
    });

    test(`should remove the ${config.singular} when user deletes it`, async ({
      page,
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const settingsPage = config.createPage(page, workspaceId);
      const api = config.createApi(request, apiHeaders, workspaceId);
      const data = config.build();
      const existing = await test.step(`create a ${config.singular} to delete (through the API)`, () =>
        api.createRecord(config.toPayload(data)));
      // Safety net only: does nothing if the test deleted it as expected.
      cleanup.add(`${config.singular} ${existing.id}`, () => api.deleteIfExists(existing.id));

      await test.step('delete it from the list, confirming the dialog names it', () =>
        settingsPage.deleteRecord(data, config.deleteConfirmation(data)));
      await test.step('it is gone from the list and the server', async () => {
        await expect(settingsPage.rowFor(data)).toHaveCount(0);
        expect((await api.get(existing.id)).status()).toBe(404);
      });
    });
  });
}

/** API tests: create, list, get, update, delete, validation and authentication. */
export function describeSettingsTableApi<
  TData,
  TPayload extends Record<string, unknown>,
  TRecord extends { id: string },
>(config: SettingsTableConfig<TData, TPayload, TRecord>): void {
  test.describe(`${config.title} API`, { tag: config.tags }, () => {
    test(`should create a ${config.singular} and return every field that was sent`, async ({
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);
      const payload = config.toPayload(config.build());

      const response = await test.step(`POST a new ${config.singular}`, () => api.create(payload));
      const body = await response.json();
      if (body.data?.id)
        cleanup.add(`${config.singular} ${body.data.id}`, () => api.deleteIfExists(body.data.id));

      await test.step('responds 201 with every field and an id', () => {
        expect(response.status()).toBe(201);
        expect(body.data).toMatchObject(payload);
        expect(body.data.id).toEqual(expect.any(String));
      });
    });

    test(`should list and return a ${config.singular} by its id`, async ({
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);
      const payload = config.toPayload(config.build());
      const created = await test.step(`create a ${config.singular}`, () => api.createRecord(payload));
      cleanup.add(`${config.singular} ${created.id}`, () => api.deleteIfExists(created.id));

      await test.step('the list contains it with the same fields', async () => {
        const listed = (await api.listRecords()).find((record) => record.id === created.id);
        expect(listed, `${config.singular} ${created.id} should be in the list`).toBeDefined();
        expect(listed).toMatchObject(payload);
      });
      await test.step('GET by id responds 200 with the same fields', async () => {
        const response = await api.get(created.id);
        expect(response.status()).toBe(200);
        expect((await response.json()).data).toMatchObject({ id: created.id, ...payload });
      });
    });

    test(`should update every field of a ${config.singular}`, async ({
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);
      const original = config.build();
      const created = await test.step(`create a ${config.singular}`, () =>
        api.createRecord(config.toPayload(original)));
      cleanup.add(`${config.singular} ${created.id}`, () => api.deleteIfExists(created.id));
      const updated = config.toPayload(config.build(original));

      const response = await test.step('update every field', () => api.update(created.id, updated));

      await test.step('responds 200, and GET returns the new values', async () => {
        expect(response.status()).toBe(200);
        expect((await (await api.get(created.id)).json()).data).toMatchObject(updated);
      });
    });

    test(`should delete a ${config.singular} so it can no longer be found`, async ({
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);
      const created = await test.step(`create a ${config.singular}`, () =>
        api.createRecord(config.toPayload(config.build())));
      cleanup.add(`${config.singular} ${created.id}`, () => api.deleteIfExists(created.id));

      const response = await test.step('DELETE it', () => api.delete(created.id));

      await test.step('responds with success', () => expect(response.ok()).toBe(true));
      await test.step(`GET by id now responds 404 "${config.notFoundMessage}"`, async () => {
        const getAfterDelete = await api.get(created.id);
        expect(getAfterDelete.status()).toBe(404);
        expect((await getAfterDelete.json()).message).toBe(config.notFoundMessage);
      });
      await test.step('the list no longer contains it', async () => {
        expect((await api.listRecords()).map((record) => record.id)).not.toContain(created.id);
      });
    });

    test(`should reject an empty ${config.singular} with 422 naming the required fields`, async ({
      request,
      apiHeaders,
      workspaceId,
      cleanup,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);

      const response = await test.step('POST an empty body', () => api.create({} as TPayload));
      const body = await response.json();
      // Only if the server wrongly accepts it: don't leave it behind.
      if (body.data?.id)
        cleanup.add(`${config.singular} ${body.data.id}`, () => api.deleteIfExists(body.data.id));

      await test.step('responds 422 with a message for every required field', () => {
        expect(response.status()).toBe(422);
        expect(body.message).toMatchObject(config.requiredFieldErrors);
      });
    });

    test('should reject a request without a login token with 401', async ({
      request,
      apiHeaders,
      workspaceId,
    }) => {
      const api = config.createApi(request, apiHeaders, workspaceId);
      const { authorization: _omitted, ...headersWithoutToken } = await apiHeaders();

      const response = await test.step('GET the list without a login token', () =>
        request.get(`${env.apiUrl}${api.path}`, { headers: headersWithoutToken }));

      await test.step('responds 401', () => expect(response.status()).toBe(401));
    });
  });
}
