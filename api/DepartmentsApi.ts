import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import { DEPARTMENT_COLORS, type DepartmentColorName, type DepartmentData } from '../utils/testData';

/** Request body for POST /v1/clinics/departments. */
export type DepartmentPayload = {
  name?: string;
  description?: string;
  /** A hex colour such as "#8B5CF6". */
  color?: string;
  externalId?: string;
};

/** A department as the API returns it (only the fields the tests use). */
export type Department = Required<DepartmentPayload> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** Convert dialog test data to the API's fields: the swatch name becomes its hex code. */
export function toDepartmentPayload(department: DepartmentData): DepartmentPayload {
  return {
    name: department.name,
    description: department.description,
    color: DEPARTMENT_COLORS[department.colorName],
    externalId: department.externalId,
  };
}

/** Convert an API department back to dialog data, to check it in the UI. */
export function toDepartmentData(department: Department): DepartmentData {
  const colorName = (Object.keys(DEPARTMENT_COLORS) as DepartmentColorName[]).find(
    (name) => DEPARTMENT_COLORS[name] === department.color,
  );
  if (!colorName) throw new Error(`${department.color} is not one of the dialog's colour swatches`);
  return {
    name: department.name,
    description: department.description,
    colorName,
    externalId: department.externalId,
  };
}

/** Client for the departments endpoints. */
export class DepartmentsApi extends ResourceApi<DepartmentPayload, Department> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.departments);
  }
}
