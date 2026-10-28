import type { Page } from '@playwright/test';
import { ClinicFormPage } from './ClinicFormPage';
import { ENDPOINTS } from '../../api/ResourceApi';
import type { DoctorData } from '../../utils/testData';

/** Clinic → Doctors: the doctors list and the new/edit doctor form. */
export class DoctorsPage extends ClinicFormPage<DoctorData> {
  constructor(page: Page) {
    super(page, {
      listPath: '/doctors',
      menuLinkName: 'Doctors',
      addButtonName: 'Add doctor',
      createButtonName: 'Add doctor',
      rowActionsButtonName: 'Doctor actions',
      apiPath: ENDPOINTS.doctors,
    });
  }
}
