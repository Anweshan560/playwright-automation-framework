import { test, expect } from '../../../fixtures/test';
import { env } from '../../../config/env';
import { buildOrganizationProfile } from '../../../utils/testData';

// These tests change the real organization (name, type, timezone…), which the rest of the app
// depends on, so they run only on their own (npm run test:organization), one at a time, and
// every test puts the original values back afterwards.
test.describe('Settings → Organization → General', { tag: ['@settings', '@organization'] }, () => {
  test.skip(
    !env.runOrganizationTests,
    'Changes the whole organization, so it must run on its own: npm run test:organization',
  );

  test('should open Organization General from the Settings menu', async ({ page, organizationPage }) => {
    await test.step('go to Settings → Organization → General', () => organizationPage.openFromDashboard());
    await test.step('the organization profile is shown', async () => {
      await expect(page).toHaveURL('/settings/organization');
      await expect(page.getByRole('heading', { name: 'Organization profile' })).toBeVisible();
      await expect(organizationPage.nameInput).not.toHaveValue('');
    });
  });

  test('should save every editable field when user updates the organization', async ({
    organizationPage,
    organizationApi,
    cleanup,
  }) => {
    const original = await test.step('remember the current organization', () => organizationApi.current());
    cleanup.add('restore the organization', () => organizationApi.restore(original));
    const updated = buildOrganizationProfile(original);

    await test.step('go to Settings → Organization → General', () => organizationPage.openFromDashboard());
    await test.step('change name, website, phone, country, timezone and type', async () => {
      await expect(organizationPage.nameInput).toHaveValue(original.name);
      await organizationPage.fillProfile(updated);
    });
    await test.step('save', () => organizationPage.save());
    await test.step('after a reload, every field shows the new value', () =>
      organizationPage.expectSavedProfile(updated));
    await test.step('the Organization ID did not change', async () => {
      await expect(organizationPage.organizationIdInput).toHaveValue(original.id);
    });
  });

  test('should not allow changing the Organization ID or the Currency', async ({
    organizationPage,
    organizationApi,
  }) => {
    const organization = await test.step('read the organization', () => organizationApi.current());

    await test.step('open Organization General', () => organizationPage.open());
    await test.step('the Organization ID is shown but read-only', async () => {
      await expect(organizationPage.organizationIdInput).toHaveValue(organization.id);
      await expect(organizationPage.organizationIdInput).not.toBeEditable();
    });
    await test.step('the Currency is shown but disabled', async () => {
      await expect(organizationPage.currencyButton).toContainText(organization.currency);
      await expect(organizationPage.currencyButton).toBeDisabled();
    });
  });
});
