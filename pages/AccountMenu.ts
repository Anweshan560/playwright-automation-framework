import { expect, type Locator, type Page } from '@playwright/test';

/** The account menu at the bottom of the sidebar: profile, workspace switcher, preferences. */
export class AccountMenu {
  readonly openButton: Locator;
  readonly menu: Locator;

  constructor(private readonly page: Page) {
    this.openButton = page.getByRole('button', { name: /account menu/ });
    this.menu = page.getByRole('menu', { name: /account menu/ });
  }

  /** The "Switch" entry, named after the current organization and workspace, e.g. "replyn · Testing". */
  private get switchItem(): Locator {
    return this.menu.getByRole('group', { name: 'Switch' }).getByRole('menuitem');
  }

  /**
   * Make `workspace` the current workspace, unless it already is. The app remembers the choice in
   * the browser only, so a fresh login otherwise opens whichever workspace the API lists first.
   */
  async switchWorkspace(workspace: string): Promise<void> {
    await this.openButton.click();
    await expect(this.switchItem).toBeVisible();
    if ((await this.switchItem.textContent())?.endsWith(` · ${workspace}`)) {
      await this.page.keyboard.press('Escape');
      return;
    }
    await this.switchItem.click();
    const workspaces = this.page.getByRole('group', { name: 'Workspaces' });
    await workspaces.getByRole('menuitem', { name: workspace, exact: true }).click();
    await expect(this.page).toHaveURL('/dashboard');

    await this.openButton.click();
    await expect(this.switchItem).toHaveText(new RegExp(` · ${workspace}$`));
    await this.page.keyboard.press('Escape');
  }
}
