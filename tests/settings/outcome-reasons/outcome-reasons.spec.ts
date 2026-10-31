import { test, expect } from '../../../fixtures/test';
import { toOutcomeReasonPayload } from '../../../api/OutcomeReasonsApi';
import { DEFAULT_OUTCOME_ANSWERS, buildOutcomeReason, type OutcomeReasonData } from '../../../utils/testData';

test.describe('Settings → Outcome Reasons', { tag: ['@settings', '@outcome-reasons'] }, () => {
  test('should open Outcome Reasons from the Settings menu with the built-in reasons', async ({
    outcomeReasonsPage,
  }) => {
    await test.step('go to Settings → Outcome Reasons', () => outcomeReasonsPage.openFromDashboard());
    await test.step('the built-in reasons are listed, marked Built-in', async () => {
      for (const label of ['Price too high', 'Treatment complete']) {
        await expect(outcomeReasonsPage.reasonEntry(label)).toContainText('Built-in');
      }
    });
  });

  test('should keep Add disabled until a reason is typed', async ({ outcomeReasonsPage }) => {
    await test.step('open Settings → Outcome Reasons', () => outcomeReasonsPage.open());
    await test.step('Add is disabled while the box is empty', async () => {
      await expect(outcomeReasonsPage.addButton).toBeDisabled();
    });
    await test.step('Add is enabled once a reason is typed', async () => {
      await outcomeReasonsPage.newReasonInput.fill('Insurance declined');
      await expect(outcomeReasonsPage.addButton).toBeEnabled();
    });
  });

  test('should add a reason shown under the default answers', async ({
    outcomeReasonsPage,
    outcomeReasonsApi,
    cleanup,
  }) => {
    const reason: OutcomeReasonData = { ...buildOutcomeReason(), showUnder: DEFAULT_OUTCOME_ANSWERS };

    await test.step('open Settings → Outcome Reasons', () => outcomeReasonsPage.open());
    const id = await test.step('type a reason and press Add', () =>
      outcomeReasonsPage.addReason(reason.label));
    cleanup.add(`outcome reason ${reason.label}`, () => outcomeReasonsApi.deleteIfExists(id));

    await test.step('it is listed under "Nothing booked · Not interested", and is not Built-in', async () => {
      await expect(outcomeReasonsPage.summary(reason)).toBeVisible();
      await expect(outcomeReasonsPage.reasonEntry(reason.label)).not.toContainText('Built-in');
    });
    await test.step('after a reload it is still listed', async () => {
      await outcomeReasonsPage.open();
      await expect(outcomeReasonsPage.summary(reason)).toBeVisible();
    });
    await test.step('the server stored the label and those answers, with no built-in key', async () => {
      const stored = await outcomeReasonsApi.findRecord(id);
      expect(stored).toMatchObject({ label: reason.label, key: null });
      expect([...stored!.answers].sort()).toEqual([...toOutcomeReasonPayload(reason).answers!].sort());
    });
  });

  test('should save the new label and answers when user edits a reason', async ({
    outcomeReasonsPage,
    outcomeReasonsApi,
    cleanup,
  }) => {
    const original = buildOutcomeReason();
    const existing = await test.step('create a reason to edit (through the API)', () =>
      outcomeReasonsApi.createRecord(toOutcomeReasonPayload(original)));
    cleanup.add(`outcome reason ${original.label}`, () => outcomeReasonsApi.deleteIfExists(existing.id));
    const updated = buildOutcomeReason(original);

    await test.step('open Settings → Outcome Reasons', () => outcomeReasonsPage.open());
    await test.step('change the label and every "Show under" answer, and save', () =>
      outcomeReasonsPage.editReason(original.label, updated));

    await test.step('after a reload, the list shows the new label and answers', async () => {
      await outcomeReasonsPage.open();
      await expect(outcomeReasonsPage.summary(updated)).toBeVisible();
      await expect(outcomeReasonsPage.editButton(original.label)).toHaveCount(0);
    });
    await test.step('the server stored the new label and answers', async () => {
      const stored = await outcomeReasonsApi.findRecord(existing.id);
      expect(stored?.label).toBe(updated.label);
      expect([...stored!.answers].sort()).toEqual([...toOutcomeReasonPayload(updated).answers!].sort());
    });
  });

  test('should keep the reason when user cancels the delete', async ({
    page,
    outcomeReasonsPage,
    outcomeReasonsApi,
    cleanup,
  }) => {
    const reason = buildOutcomeReason();
    const existing = await test.step('create a reason (through the API)', () =>
      outcomeReasonsApi.createRecord(toOutcomeReasonPayload(reason)));
    cleanup.add(`outcome reason ${reason.label}`, () => outcomeReasonsApi.deleteIfExists(existing.id));

    await test.step('open Settings → Outcome Reasons', () => outcomeReasonsPage.open());
    const question = await test.step('press Delete: the page asks to confirm, naming it', () =>
      outcomeReasonsPage.startDelete(reason.label));
    await test.step('press Cancel', () =>
      page.getByRole('main').getByRole('button', { name: 'Cancel', exact: true }).click());

    await test.step('the question goes away and the reason stays, on the page and the server', async () => {
      await expect(question).toBeHidden();
      await expect(outcomeReasonsPage.editButton(reason.label)).toBeVisible();
      expect(await outcomeReasonsApi.findRecord(existing.id)).toBeDefined();
    });
  });

  test('should remove the reason when user deletes it', async ({
    outcomeReasonsPage,
    outcomeReasonsApi,
    cleanup,
  }) => {
    const reason = buildOutcomeReason();
    const existing = await test.step('create a reason to delete (through the API)', () =>
      outcomeReasonsApi.createRecord(toOutcomeReasonPayload(reason)));
    // Safety net only: does nothing if the test deleted it as expected.
    cleanup.add(`outcome reason ${reason.label}`, () => outcomeReasonsApi.deleteIfExists(existing.id));

    await test.step('open Settings → Outcome Reasons', () => outcomeReasonsPage.open());
    await test.step('delete it, confirming the question that names it', () =>
      outcomeReasonsPage.deleteReason(reason.label));

    await test.step('it is gone from the list and the server', async () => {
      await expect(outcomeReasonsPage.editButton(reason.label)).toHaveCount(0);
      expect(await outcomeReasonsApi.findRecord(existing.id)).toBeUndefined();
    });
  });
});
