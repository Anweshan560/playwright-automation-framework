import { test, expect } from '../../../fixtures/test';
import { toDepartmentPayload, type Department } from '../../../api/DepartmentsApi';
import { ENDPOINTS } from '../../../api/ResourceApi';
import { env } from '../../../config/env';
import { measureResponseTimes, median } from '../../../utils/timing';
import { buildDepartment } from '../../../utils/testData';

test.describe('Departments API', { tag: ['@clinic', '@departments'] }, () => {
  test('should create a department and return every field that was sent', async ({
    departmentsApi,
    cleanup,
  }) => {
    const payload = toDepartmentPayload(buildDepartment());

    const response = await test.step('POST a new department', () => departmentsApi.create(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`department ${body.data.id}`, () => departmentsApi.deleteIfExists(body.data.id));

    await test.step('responds 201', () => {
      expect(response.status()).toBe(201);
    });
    await test.step('returns every field unchanged, plus a server-generated id', () => {
      expect(body.message).toBe('OK');
      expect(body.data).toMatchObject(payload);
      expect(body.data.id).toEqual(expect.any(String));
    });
  });

  test('should include a newly created department in the list', async ({ departmentsApi, cleanup }) => {
    const payload = toDepartmentPayload(buildDepartment());
    const created = await test.step('create a department', () => departmentsApi.createRecord(payload));
    cleanup.add(`department ${created.id}`, () => departmentsApi.deleteIfExists(created.id));

    const response = await test.step('GET the list', () => departmentsApi.list());

    await test.step('responds 200', () => {
      expect(response.status()).toBe(200);
    });
    await test.step('the list contains the new department with the same fields', async () => {
      const { data }: { data: Department[] } = await response.json();
      const listed = data.find((department) => department.id === created.id);
      expect(listed, `department ${created.id} should be in the list`).toBeDefined();
      // Compare the fields that were sent; timestamps like updatedAt can change after creation.
      expect(listed).toMatchObject(payload);
    });
  });

  test('should return a department by its id', async ({ departmentsApi, cleanup }) => {
    const payload = toDepartmentPayload(buildDepartment());
    const created = await test.step('create a department', () => departmentsApi.createRecord(payload));
    cleanup.add(`department ${created.id}`, () => departmentsApi.deleteIfExists(created.id));

    const response = await test.step('GET it by id', () => departmentsApi.get(created.id));

    await test.step('responds 200 with the same department', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: created.id, ...payload });
    });
  });

  test('should delete a department so it can no longer be found', async ({ departmentsApi, cleanup }) => {
    const created = await test.step('create a department', () =>
      departmentsApi.createRecord(toDepartmentPayload(buildDepartment())));
    cleanup.add(`department ${created.id}`, () => departmentsApi.deleteIfExists(created.id));

    const response = await test.step('DELETE it', () => departmentsApi.delete(created.id));

    await test.step('responds 200 and confirms which department was deleted', async () => {
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toEqual({ id: created.id, deleted: true });
    });
    await test.step('GET by id now responds 404 "Department not found"', async () => {
      const getAfterDelete = await departmentsApi.get(created.id);
      expect(getAfterDelete.status()).toBe(404);
      expect((await getAfterDelete.json()).message).toBe('Department not found');
    });
    await test.step('the list no longer contains it', async () => {
      const departments = await departmentsApi.listRecords();
      expect(departments.map((department) => department.id)).not.toContain(created.id);
    });
  });

  test('should reject a department without a name with 422', async ({ departmentsApi, cleanup }) => {
    const { name: _omitted, ...payloadWithoutName } = toDepartmentPayload(buildDepartment());

    const response = await test.step('POST a department with no name', () =>
      departmentsApi.create(payloadWithoutName));
    const body = await response.json();
    // Only if the server wrongly accepts it: don't leave it behind.
    if (body.data?.id)
      cleanup.add(`department ${body.data.id}`, () => departmentsApi.deleteIfExists(body.data.id));

    await test.step('responds 422 with an error about the name and creates nothing', () => {
      expect(response.status()).toBe(422);
      expect(body.message).toHaveProperty('name');
      expect(body.data).toBeUndefined();
    });
  });

  test('should reject a colour that is not a hex code with 422', async ({ departmentsApi, cleanup }) => {
    const payload = { ...toDepartmentPayload(buildDepartment()), color: 'purple' };

    const response = await test.step('POST a department with color "purple"', () =>
      departmentsApi.create(payload));
    const body = await response.json();
    if (body.data?.id)
      cleanup.add(`department ${body.data.id}`, () => departmentsApi.deleteIfExists(body.data.id));

    await test.step('responds 422 "color must be a hexadecimal color" and creates nothing', () => {
      expect(response.status()).toBe(422);
      expect(body.message.color).toBe('color must be a hexadecimal color');
      expect(body.data).toBeUndefined();
    });
  });

  test('should answer list requests within the response-time budget', async ({ departmentsApi }) => {
    const durations = await test.step('GET the list 5 times in a row', () =>
      measureResponseTimes(() => departmentsApi.list(), 5));

    await test.step(`the median response time is under ${env.apiResponseBudgetMs} ms`, () => {
      expect(median(durations), `response times (ms): ${durations.join(', ')}`).toBeLessThan(
        env.apiResponseBudgetMs,
      );
    });
  });
  test('should reject a request with an invalid login token with 401', async ({ request, apiHeaders }) => {
    const headers = { ...(await apiHeaders()), authorization: 'Bearer not-a-real-token' };

    const response = await test.step('GET the list with a made-up token', () =>
      request.get(`${env.apiUrl}${ENDPOINTS.departments}`, { headers }));

    await test.step('responds 401 "Unauthorized"', async () => {
      expect(response.status()).toBe(401);
      expect((await response.json()).message).toBe('Unauthorized');
    });
  });
});
