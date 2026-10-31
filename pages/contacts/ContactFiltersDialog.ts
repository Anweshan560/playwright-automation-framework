import { expect, type Locator, type Page } from '@playwright/test';
import { ENDPOINTS } from '../../api/ResourceApi';
import type { Segment } from '../../api/ContactsApi';
import { waitForApiResponse } from '../../utils/network';

/**
 * Contacts → Filter contacts: build rules, watch the "N contacts match" preview, and save the
 * rules as a segment.
 */
export class ContactFiltersDialog {
  readonly root: Locator;
  readonly segmentNameInput: Locator;
  readonly addRuleButton: Locator;
  readonly createSegmentButton: Locator;
  /** "2 contacts match", "1 contact matches". */
  readonly matchCount: Locator;
  readonly preview: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Filters' });
    this.segmentNameInput = this.root.getByRole('textbox', { name: 'Segment name' });
    this.addRuleButton = this.root.getByRole('button', { name: 'Add rule' });
    this.createSegmentButton = this.root.getByRole('button', { name: 'Create segment' });
    this.matchCount = this.root.getByRole('heading', { level: 6 });
    this.preview = this.root.getByRole('grid', { name: 'Matching contacts' });
  }

  async open(): Promise<void> {
    await this.page.getByRole('button', { name: 'Filter contacts' }).first().click();
    await expect(this.root).toBeVisible();
  }

  /** Add a rule. A new rule starts as "First name contains …"; type the value. */
  async addFirstNameContainsRule(text: string): Promise<void> {
    await this.addRuleButton.click();
    // The field button shows its value through a label next to it, so check its accessible name.
    await expect(this.root.getByRole('button', { name: /Filter field$/ })).toHaveAccessibleName(
      'First name Filter field',
    );
    await expect(this.root.getByRole('button', { name: /Select operator$/ })).toHaveText('contains');
    await this.root.getByRole('textbox', { name: 'Enter value' }).fill(text);
  }

  /** A contact's row in the preview. */
  previewRow(name: string): Locator {
    return this.preview.getByRole('row').filter({ hasText: name });
  }

  /** Name the rules and save them as a segment; returns the new segment. */
  async saveAsSegment(name: string): Promise<Segment> {
    await this.segmentNameInput.fill(name);
    const created = waitForApiResponse(this.page, 'POST', ENDPOINTS.segments);
    await this.createSegmentButton.click();
    const response = await created;
    expect(response.status(), 'the server should create the segment').toBe(201);
    await expect(this.root).toBeHidden();
    return (await response.json()).data;
  }
}
