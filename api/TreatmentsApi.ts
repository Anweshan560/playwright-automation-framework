import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import type { TreatmentData } from '../utils/testData';

/** Request body for POST /v1/clinics/treatments. */
export type TreatmentPayload = {
  name?: string;
  description?: string;
  price?: number;
  discountedPrice?: number;
  /** The form's "Page on your website". */
  pageUrl?: string;
  /** The form's "ID in your EMR". */
  externalId?: string;
};

/** A treatment as the API returns it (only the fields the tests use). */
export type Treatment = Required<TreatmentPayload> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** Convert form test data to the API's field names and types. */
export function toTreatmentPayload(treatment: TreatmentData): TreatmentPayload {
  return {
    name: treatment.name,
    description: treatment.description,
    price: Number(treatment.price),
    discountedPrice: Number(treatment.discountedPrice),
    pageUrl: treatment.website,
    externalId: treatment.emrId,
  };
}

/** Convert an API treatment back to form data, to check it in the UI. */
export function toTreatmentData(treatment: Treatment): TreatmentData {
  return {
    name: treatment.name,
    description: treatment.description,
    price: String(treatment.price),
    discountedPrice: String(treatment.discountedPrice),
    website: treatment.pageUrl,
    emrId: treatment.externalId,
  };
}

/** Client for the treatments endpoints. */
export class TreatmentsApi extends ResourceApi<TreatmentPayload, Treatment> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.treatments);
  }
}
