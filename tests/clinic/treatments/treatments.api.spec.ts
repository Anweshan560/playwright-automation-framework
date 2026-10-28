import { test, expect } from '../../../fixtures/test';
import { ENDPOINTS } from '../../../api/ResourceApi';
import { toTreatmentPayload, type Treatment } from '../../../api/TreatmentsApi';
import { env } from '../../../config/env';
import { measureResponseTimes, median } from '../../../utils/timing';
import { buildTreatment } from '../../../utils/testData';

test.describe('Treatments API', { tag: ['@clinic', '@treatments'] }, () => {
  test('should create a treatment and return every field that was sent', async ({
    treatmentsApi,
    cleanup,
  }) => {
    const payload = toTreatmentPayload(buildTreatment());

    const response = await test.step('POST a new treatment', () => treatmentsApi.create(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`treatment ${body.data.id}`, () => treatmentsApi.deleteIfExists(body.data.id));

    await test.step('responds 201', () => {
      expect(response.status()).toBe(201);
    });
    await test.step('returns every field unchanged, plus a server-generated id', () => {
      expect(body.message).toBe('OK');
      expect(body.data).toMatchObject(payload);
      expect(body.data.id).toEqual(expect.any(String));
    });
  });

  test('should include a newly created treatment in the list', async ({ treatmentsApi, cleanup }) => {
    const payload = toTreatmentPayload(buildTreatment());
    const created = await test.step('create a treatment', () => treatmentsApi.createRecord(payload));
    cleanup.add(`treatment ${created.id}`, () => treatmentsApi.deleteIfExists(created.id));

    const response = await test.step('GET the list', () => treatmentsApi.list());

    await test.step('responds 200', () => {
      expect(response.status()).toBe(200);
    });
    await test.step('the list contains the new treatment with the same fields', async () => {
      const { data }: { data: Treatment[] } = await response.json();
      const listed = data.find((treatment) => treatment.id === created.id);
      expect(listed, `treatment ${created.id} should be in the list`).toBeDefined();
      // Compare the fields that were sent; timestamps like updatedAt can change after creation.
      expect(listed).toMatchObject(payload);
    });
  });

  test('should return a treatment by its id', async ({ treatmentsApi, cleanup }) => {
    const payload = toTreatmentPayload(buildTreatment());
    const created = await test.step('create a treatment', () => treatmentsApi.createRecord(payload));
    cleanup.add(`treatment ${created.id}`, () => treatmentsApi.deleteIfExists(created.id));

    const response = await test.step('GET it by id', () => treatmentsApi.get(created.id));

    await test.step('responds 200 with the same treatment', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: created.id, ...payload });
    });
  });

  test('should delete a treatment so it can no longer be found', async ({ treatmentsApi, cleanup }) => {
    const created = await test.step('create a treatment', () =>
      treatmentsApi.createRecord(toTreatmentPayload(buildTreatment())));
    cleanup.add(`treatment ${created.id}`, () => treatmentsApi.deleteIfExists(created.id));

    const response = await test.step('DELETE it', () => treatmentsApi.delete(created.id));

    await test.step('responds 200', () => expect(response.status()).toBe(200));
    await test.step('GET by id now responds 404 "Treatment not found"', async () => {
      const getAfterDelete = await treatmentsApi.get(created.id);
      expect(getAfterDelete.status()).toBe(404);
      expect((await getAfterDelete.json()).message).toBe('Treatment not found');
    });
    await test.step('the list no longer contains it', async () => {
      const treatments = await treatmentsApi.listRecords();
      expect(treatments.map((treatment) => treatment.id)).not.toContain(created.id);
    });
  });

  test('should reject a treatment without a name with 422', async ({ treatmentsApi, cleanup }) => {
    const { name: _omitted, ...payloadWithoutName } = toTreatmentPayload(buildTreatment());

    const response = await test.step('POST a treatment with no name', () =>
      treatmentsApi.create(payloadWithoutName));
    const body = await response.json();
    // Only if the server wrongly accepts it: don't leave it behind.
    if (body.data?.id)
      cleanup.add(`treatment ${body.data.id}`, () => treatmentsApi.deleteIfExists(body.data.id));

    await test.step('responds 422 with an error about the name and creates nothing', () => {
      expect(response.status()).toBe(422);
      expect(body.message).toHaveProperty('name');
      expect(body.data).toBeUndefined();
    });
  });

  test('should answer list requests within the response-time budget', async ({ treatmentsApi }) => {
    const durations = await test.step('GET the list 5 times in a row', () =>
      measureResponseTimes(() => treatmentsApi.list(), 5));

    await test.step(`the median response time is under ${env.apiResponseBudgetMs} ms`, () => {
      expect(median(durations), `response times (ms): ${durations.join(', ')}`).toBeLessThan(
        env.apiResponseBudgetMs,
      );
    });
  });
  test('should reject a request without a login token with 401', async ({ request, apiHeaders }) => {
    const { authorization: _omitted, ...headersWithoutToken } = await apiHeaders();

    const response = await test.step('GET the list without a login token', () =>
      request.get(`${env.apiUrl}${ENDPOINTS.treatments}`, { headers: headersWithoutToken }));

    await test.step('responds 401 "No authentication token provided"', async () => {
      expect(response.status()).toBe(401);
      expect((await response.json()).message).toBe('No authentication token provided');
    });
  });
});
