import { test, expect } from '../../../fixtures/test';
import { aroundNow, untilAfter } from '../../../api/ReportsApi';
import { toContactPayload } from '../../../api/ContactsApi';
import { runOnlyOnItsOwn } from '../../exclusive';
import { bookThroughApi, createDoctorAndTreatment } from '../../clinic/bookingSetup';
import {
  buildContact,
  buildPatient,
  buildPaymentAmount,
  nextClinicDay,
  toDateParam,
} from '../../../utils/testData';

// Each test reads a count, adds known data, and checks the count moved by exactly that much.
// Other tests add and remove contacts, bookings and payments, so these run on their own.
test.describe('Report numbers API', { tag: ['@reports', '@report-numbers'] }, () => {
  runOnlyOnItsOwn();

  test('should count new contacts in the contacts summary', async ({ reportsApi, contactsApi, cleanup }) => {
    const range = aroundNow();
    const before = await test.step('read the contacts summary', () => reportsApi.contactsSummary(range));

    await test.step('create two contacts', async () => {
      for (let i = 0; i < 2; i++) {
        const contact = await contactsApi.createRecord(toContactPayload(buildContact()));
        cleanup.add(`contact ${contact.id}`, () => contactsApi.deleteIfExists(contact.id));
      }
    });

    await test.step('all contacts and contacts added both went up by 2, in the first stage too', async () => {
      await expect
        .poll(() => reportsApi.contactsSummary(range))
        .toMatchObject({
          total: before.total + 2,
          createdInRange: before.createdInRange + 2,
          firstStage: { createdInRange: before.firstStage.createdInRange + 2 },
        });
    });
  });

  test('should count a new contact as a new lead on the dashboard', async ({
    reportsApi,
    contactsApi,
    cleanup,
  }) => {
    const range = aroundNow();
    const before = (await reportsApi.dashboardClinic(range)).leads.newLeads;

    await test.step('create a contact', async () => {
      const contact = await contactsApi.createRecord(toContactPayload(buildContact()));
      cleanup.add(`contact ${contact.id}`, () => contactsApi.deleteIfExists(contact.id));
    });

    await test.step('the dashboard counts one more new lead', async () => {
      await expect
        .poll(async () => (await reportsApi.dashboardClinic(range)).leads.newLeads)
        .toBe(before + 1);
    });
  });

  test('should count a booking as scheduled in the appointments summary and the dashboard', async ({
    reportsApi,
    appointmentsApi,
    contactsApi,
    doctorsApi,
    treatmentsApi,
    cleanup,
  }) => {
    const visit = nextClinicDay();
    const range = untilAfter(visit);
    const before = await test.step('read the appointment numbers', async () => ({
      summary: (await reportsApi.appointmentsSummary(range)).scheduled.value,
      dashboard: (await reportsApi.dashboardClinic(range)).appointments.scheduled,
    }));

    await test.step('book an appointment on the next clinic day', async () => {
      const setup = await createDoctorAndTreatment({ doctorsApi, treatmentsApi }, cleanup);
      await bookThroughApi({ appointmentsApi, contactsApi }, cleanup, setup, buildPatient(), visit);
    });

    await test.step('both count one more scheduled appointment', async () => {
      await expect
        .poll(async () => (await reportsApi.appointmentsSummary(range)).scheduled.value)
        .toBe(before.summary + 1);
      await expect
        .poll(async () => (await reportsApi.dashboardClinic(range)).appointments.scheduled)
        .toBe(before.dashboard + 1);
    });
  });

  test('should add an advance to the money taken in on the dashboard', async ({
    reportsApi,
    billingApi,
    contactsApi,
    cleanup,
  }) => {
    const range = aroundNow();
    const before = (await reportsApi.dashboardClinic(range)).money.advances;
    const amount = buildPaymentAmount();

    await test.step(`record an advance of ${amount} for a new patient`, async () => {
      // Deleting the contact afterwards also removes the advance.
      const patient = await contactsApi.createRecord(buildPatient());
      cleanup.add(`patient ${patient.id}`, () => contactsApi.deleteIfExists(patient.id));
      expect(
        (await billingApi.addAdvance(patient.id, { amount, advanceDate: toDateParam(new Date()) })).status(),
      ).toBe(201);
    });

    await test.step(`new advances went up by ${amount}, in one more payment`, async () => {
      await expect
        .poll(async () => (await reportsApi.dashboardClinic(range)).money.advances)
        .toMatchObject({
          amount: before.amount + amount,
          count: before.count + 1,
        });
    });
  });
});
