import { test, expect } from '../../../fixtures/test';
import { SLA_CLOCKS, defaultSlaClock } from '../../../api/WorkspaceApi';
import { runOnlyOnItsOwn } from '../../exclusive';
import type { SlaClockName } from '../../../pages/settings/SlaPage';

const CLOCKS: SlaClockName[] = [
  'First reply',
  'Subsequent reply',
  'Open conversation',
  'Follow-up overdue',
  'Echo waiting',
  'Unassigned',
];

// SLA clocks time real conversations, so these tests run on their own and put the clocks back.
test.describe('Settings → SLAs', { tag: ['@settings', '@sla'] }, () => {
  runOnlyOnItsOwn();

  test.beforeEach(async ({ slasApi, cleanup }) => {
    cleanup.add('restore the SLA clocks', await slasApi.rememberCurrent());
  });

  test('should open SLAs from the Settings menu with a tab for every clock', async ({ slaPage }) => {
    await test.step('go to Settings → SLAs', () => slaPage.openFromDashboard());
    await test.step('there is a tab for each of the six clocks', async () => {
      for (const clock of CLOCKS) await expect(slaPage.tab(clock)).toBeVisible();
    });
  });

  test('should save a clock when user turns it on with a target', async ({ slaPage, slasApi }) => {
    await test.step('start with every clock off at its 1 hour default (through the API)', async () => {
      expect((await slasApi.save(SLA_CLOCKS.map(defaultSlaClock))).ok()).toBe(true);
    });

    await test.step('open Settings → SLAs and select First reply', async () => {
      await slaPage.open();
      await slaPage.selectClock('First reply');
    });
    await test.step('turn it on and set the target to 3 hours', async () => {
      await slaPage.setEnabled('First reply', true);
      await slaPage.setTarget('First reply', 3);
      await expect(slaPage.unitButton('First reply')).toHaveText('hours');
    });
    await test.step('save', () => slaPage.save());

    await test.step('the tab shows the clock as Active', async () => {
      await expect(slaPage.tabState('First reply')).toHaveAccessibleName('Active');
    });
    await test.step('the server stored it on, with a 3 hour (10,800 second) target', async () => {
      const firstReply = (await slasApi.clocks()).find((clock) => clock.clock === 'first_reply');
      expect(firstReply).toMatchObject({
        enabled: true,
        durationValue: 3,
        durationUnit: 'hours',
        durationSeconds: 10_800,
      });
    });
  });

  test('should save a clock as off when user turns it off', async ({ slaPage, slasApi }) => {
    await test.step('turn First reply on (through the page)', async () => {
      await slaPage.open();
      await slaPage.selectClock('First reply');
      await slaPage.setEnabled('First reply', true);
      await slaPage.save();
    });

    await test.step('turn it off again and save', async () => {
      await slaPage.open();
      await slaPage.selectClock('First reply');
      await slaPage.setEnabled('First reply', false);
      await slaPage.save();
    });

    await test.step('the tab shows Off, and the server stored it off', async () => {
      await expect(slaPage.tabState('First reply')).toHaveAccessibleName('Off');
      expect((await slasApi.clocks()).find((clock) => clock.clock === 'first_reply')?.enabled).toBe(false);
    });
  });
});
