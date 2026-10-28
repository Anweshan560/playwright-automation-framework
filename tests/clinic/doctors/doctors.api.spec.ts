import { test, expect } from '../../../fixtures/test';
import { toDoctorPayload, type Doctor } from '../../../api/DoctorsApi';
import { ENDPOINTS } from '../../../api/ResourceApi';
import { env } from '../../../config/env';
import { measureResponseTimes, median } from '../../../utils/timing';
import { buildDoctor } from '../../../utils/testData';

test.describe('Doctors API', { tag: ['@clinic', '@doctors'] }, () => {
  test('should create a doctor and return every field that was sent', async ({ doctorsApi, cleanup }) => {
    const payload = toDoctorPayload(buildDoctor());

    const response = await test.step('POST a new doctor', () => doctorsApi.create(payload));
    const body = await response.json();
    if (body.data?.id) cleanup.add(`doctor ${body.data.id}`, () => doctorsApi.deleteIfExists(body.data.id));

    await test.step('responds 201', () => {
      expect(response.status()).toBe(201);
    });
    await test.step('returns every field unchanged, plus a server-generated id', () => {
      expect(body.message).toBe('OK');
      expect(body.data).toMatchObject(payload);
      expect(body.data.id).toEqual(expect.any(String));
    });
  });

  test('should include a newly created doctor in the list', async ({ doctorsApi, cleanup }) => {
    const payload = toDoctorPayload(buildDoctor());
    const created = await test.step('create a doctor', () => doctorsApi.createRecord(payload));
    cleanup.add(`doctor ${created.id}`, () => doctorsApi.deleteIfExists(created.id));

    const response = await test.step('GET the list', () => doctorsApi.list());

    await test.step('responds 200', () => {
      expect(response.status()).toBe(200);
    });
    await test.step('the list contains the new doctor with the same fields', async () => {
      const { data }: { data: Doctor[] } = await response.json();
      const listed = data.find((doctor) => doctor.id === created.id);
      expect(listed, `doctor ${created.id} should be in the list`).toBeDefined();
      // Compare the fields that were sent; timestamps like updatedAt can change after creation.
      expect(listed).toMatchObject(payload);
    });
  });

  test('should return a doctor by its id', async ({ doctorsApi, cleanup }) => {
    const payload = toDoctorPayload(buildDoctor());
    const created = await test.step('create a doctor', () => doctorsApi.createRecord(payload));
    cleanup.add(`doctor ${created.id}`, () => doctorsApi.deleteIfExists(created.id));

    const response = await test.step('GET it by id', () => doctorsApi.get(created.id));

    await test.step('responds 200 with the same doctor', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: created.id, ...payload });
    });
  });

  test('should delete a doctor so it can no longer be found', async ({ doctorsApi, cleanup }) => {
    const created = await test.step('create a doctor', () =>
      doctorsApi.createRecord(toDoctorPayload(buildDoctor())));
    cleanup.add(`doctor ${created.id}`, () => doctorsApi.deleteIfExists(created.id));

    const response = await test.step('DELETE it', () => doctorsApi.delete(created.id));

    await test.step('responds 200', () => expect(response.status()).toBe(200));
    await test.step('GET by id now responds 404 "Doctor not found"', async () => {
      const getAfterDelete = await doctorsApi.get(created.id);
      expect(getAfterDelete.status()).toBe(404);
      expect((await getAfterDelete.json()).message).toBe('Doctor not found');
    });
    await test.step('the list no longer contains it', async () => {
      const doctors = await doctorsApi.listRecords();
      expect(doctors.map((doctor) => doctor.id)).not.toContain(created.id);
    });
  });

  test('should reject a doctor without a name with 422', async ({ doctorsApi, cleanup }) => {
    const { name: _omitted, ...payloadWithoutName } = toDoctorPayload(buildDoctor());

    const response = await test.step('POST a doctor with no name', () =>
      doctorsApi.create(payloadWithoutName));
    const body = await response.json();
    // Only if the server wrongly accepts it: don't leave it behind.
    if (body.data?.id) cleanup.add(`doctor ${body.data.id}`, () => doctorsApi.deleteIfExists(body.data.id));

    await test.step('responds 422 with an error about the name and creates nothing', () => {
      expect(response.status()).toBe(422);
      expect(body.message).toHaveProperty('name');
      expect(body.data).toBeUndefined();
    });
  });

  test('should answer list requests within the response-time budget', async ({ doctorsApi }) => {
    const durations = await test.step('GET the list 5 times in a row', () =>
      measureResponseTimes(() => doctorsApi.list(), 5));

    await test.step(`the median response time is under ${env.apiResponseBudgetMs} ms`, () => {
      expect(median(durations), `response times (ms): ${durations.join(', ')}`).toBeLessThan(
        env.apiResponseBudgetMs,
      );
    });
  });
  test('should reject a request with an invalid login token with 401', async ({ request, apiHeaders }) => {
    const headers = { ...(await apiHeaders()), authorization: 'Bearer not-a-real-token' };

    const response = await test.step('GET the list with a made-up token', () =>
      request.get(`${env.apiUrl}${ENDPOINTS.doctors}`, { headers }));

    await test.step('responds 401 "Unauthorized"', async () => {
      expect(response.status()).toBe(401);
      expect((await response.json()).message).toBe('Unauthorized');
    });
  });
});
