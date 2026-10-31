import { test, expect } from '../../../fixtures/test';
import { toWebhookPayload } from '../../../api/DeveloperApi';
import { WEBHOOK_EVENT, buildWebhook } from '../../../utils/testData';

// Webhooks point at example.com, so nothing is ever delivered anywhere real.
test.describe('Settings → API Keys → Webhooks', { tag: ['@settings', '@webhooks'] }, () => {
  test('should open the Webhooks tab from the Settings menu', async ({ webhooksPage }) => {
    await test.step('go to Settings → API Keys → Webhooks', () => webhooksPage.openFromDashboard());
    await test.step('the tab explains webhooks and offers Add Webhook', async () => {
      await expect(webhooksPage.panel).toContainText('Receive real-time HTTP notifications');
      await expect(webhooksPage.addButton).toBeVisible();
    });
  });

  test('should save every field when user creates a webhook', async ({
    webhooksPage,
    webhooksApi,
    cleanup,
  }) => {
    const webhook = buildWebhook();

    await test.step('open Settings → API Keys → Webhooks', () => webhooksPage.open());
    const id = await test.step('fill in the URL, description and event, and create', () =>
      webhooksPage.createWebhook(webhook));
    cleanup.add(`webhook ${webhook.url}`, () => webhooksApi.deleteIfExists(id));

    await test.step('its card shows the URL, description and event', async () => {
      const card = webhooksPage.card(webhook);
      await expect(card).toContainText(webhook.description);
      await expect(card).toContainText(WEBHOOK_EVENT);
    });
    await test.step('after a reload, the edit dialog shows every field', () =>
      webhooksPage.expectSavedValues(webhook));
    await test.step('the server stored every field, enabled', async () => {
      expect(await webhooksApi.findRecord(id)).toMatchObject({
        ...toWebhookPayload(webhook),
        disabled: false,
      });
    });
  });

  test('should save every change when user edits a webhook', async ({
    webhooksPage,
    webhooksApi,
    cleanup,
  }) => {
    const original = buildWebhook();
    const existing = await test.step('create a webhook to edit (through the API)', () =>
      webhooksApi.createRecord(toWebhookPayload(original)));
    cleanup.add(`webhook ${original.url}`, () => webhooksApi.deleteIfExists(existing.id));
    const updated = buildWebhook();

    await test.step('change the URL and description, and save', () =>
      webhooksPage.editWebhook(original, updated));
    await test.step('after a reload, the edit dialog shows the new values', () =>
      webhooksPage.expectSavedValues(updated));
    await test.step('the old URL is no longer listed', async () => {
      await expect(webhooksPage.card(original)).toHaveCount(0);
    });
    await test.step('the server stored the new values', async () => {
      expect(await webhooksApi.findRecord(existing.id)).toMatchObject(toWebhookPayload(updated));
    });
  });

  test('should reveal the signing secret the server uses', async ({ webhooksPage, webhooksApi, cleanup }) => {
    const webhook = buildWebhook();
    const existing = await test.step('create a webhook (through the API)', () =>
      webhooksApi.createRecord(toWebhookPayload(webhook)));
    cleanup.add(`webhook ${webhook.url}`, () => webhooksApi.deleteIfExists(existing.id));

    await test.step('open Settings → API Keys → Webhooks', () => webhooksPage.open());
    const shown = await test.step('press Reveal signing secret', () =>
      webhooksPage.revealSigningSecret(webhook));

    await test.step('the secret shown is the one the server signs with', async () => {
      const stored = (await (await webhooksApi.signingSecret(existing.id)).json()).data.key;
      // Compare without printing either value: they are real credentials.
      expect(shown.startsWith('whsec_'), 'the secret should start with whsec_').toBe(true);
      expect(shown === stored, 'the dialog should show the stored secret').toBe(true);
    });
    await test.step('Done closes it', () => webhooksPage.closeSigningSecret());
  });

  test('should only delete a webhook once DELETE is typed', async ({
    webhooksPage,
    webhooksApi,
    cleanup,
  }) => {
    const webhook = buildWebhook();
    const existing = await test.step('create a webhook to delete (through the API)', () =>
      webhooksApi.createRecord(toWebhookPayload(webhook)));
    // Safety net only: does nothing if the test deleted it as expected.
    cleanup.add(`webhook ${webhook.url}`, () => webhooksApi.deleteIfExists(existing.id));

    await test.step('press Delete: the dialog names the URL, and its button is disabled', async () => {
      const deleteButton = await webhooksPage.startDelete(webhook);
      await expect(deleteButton).toBeDisabled();
    });
    await test.step('typing something else keeps it disabled', async () => {
      await webhooksPage.deleteDialog.getByRole('textbox', { name: 'Confirm' }).fill('delete');
      await expect(webhooksPage.deleteDialog.getByRole('button', { name: 'Delete Webhook' })).toBeDisabled();
      await webhooksPage.deleteDialog.getByRole('button', { name: 'Cancel' }).click();
    });
    await test.step('delete it, typing DELETE', () => webhooksPage.deleteWebhook(webhook));
    await test.step('it is gone from the page and the server', async () => {
      await expect(webhooksPage.card(webhook)).toHaveCount(0);
      expect(await webhooksApi.findRecord(existing.id)).toBeUndefined();
    });
  });
});
