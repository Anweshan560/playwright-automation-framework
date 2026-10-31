import { expect, type Locator } from '@playwright/test';

/**
 * Turn an app switch on or off. The real switch input sits under the app's styled track, which
 * takes the clicks, so click its visible label the way a user does, then confirm the new state.
 */
export async function setSwitch(toggle: Locator, label: Locator, on: boolean): Promise<void> {
  if ((await toggle.isChecked()) !== on) await label.click();
  await expect(toggle).toBeChecked({ checked: on });
}
