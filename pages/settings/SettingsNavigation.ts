import { expect, type Locator, type Page } from '@playwright/test';

/** The Settings menu: reached from the sidebar's Settings link, grouped into collapsible sections. */
export class SettingsNavigation {
  readonly menu: Locator;

  constructor(private readonly page: Page) {
    this.menu = page.getByRole('navigation', { name: 'Settings navigation' });
  }

  /**
   * Go from the dashboard to a settings page as a user would: sidebar → Settings → group → page.
   * @param group the section, e.g. "Organization"
   * @param pageName the link inside it, e.g. "Members"
   */
  async openFromDashboard(group: string, pageName: string): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(this.page).toHaveURL('/settings');

    const groupLinks = this.menu.getByRole('group', { name: group });
    // Sections start collapsed; open this one unless it already is.
    if (!(await groupLinks.isVisible())) {
      await this.menu.getByRole('button', { name: group, exact: true }).click();
    }
    await groupLinks.getByRole('link', { name: pageName, exact: true }).click();
  }
}
