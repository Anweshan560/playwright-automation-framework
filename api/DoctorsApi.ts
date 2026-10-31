import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import type { DoctorData } from '../utils/testData';

/** Request body for POST /v1/clinics/doctors. */
export type DoctorPayload = {
  name?: string;
  description?: string;
  /** The form's "Page on your website". Note: treatments call this field `pageUrl`. */
  profileUrl?: string;
  /** The form's "ID in your EMR". */
  externalId?: string;
  /** Treatments this doctor offers; the New appointment dialog lists only these. */
  treatmentIds?: string[];
};

/** A doctor as the API returns it (only the fields the tests use). */
export type Doctor = Required<Omit<DoctorPayload, 'treatmentIds'>> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  treatments: { id: string; name: string }[];
};

/** Convert form test data to the API's field names. */
export function toDoctorPayload(doctor: DoctorData): DoctorPayload {
  return {
    name: doctor.name,
    description: doctor.description,
    profileUrl: doctor.website,
    externalId: doctor.emrId,
  };
}

/** Convert an API doctor back to form data, to check it in the UI. */
export function toDoctorData(doctor: Doctor): DoctorData {
  return {
    name: doctor.name,
    description: doctor.description,
    website: doctor.profileUrl,
    emrId: doctor.externalId,
  };
}

/** Client for the doctors endpoints. */
export class DoctorsApi extends ResourceApi<DoctorPayload, Doctor> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.doctors);
  }
}
