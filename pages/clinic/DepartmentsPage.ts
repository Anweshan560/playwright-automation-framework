import { expect, type Locator, type Page } from '@playwright/test';
import { ClinicListPage } from './ClinicListPage';
import { ENDPOINTS } from '../../api/ResourceApi';
import { waitForApiResponse } from '../../utils/network';
import type { DepartmentData } from '../../utils/testData';

/** The fields of the Add Department and Edit Department dialogs. */
export class DepartmentDialog {
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly externalIdInput: Locator;
  readonly nameRequiredError: Locator;

  constructor(readonly root: Locator) {
    this.nameInput = root.getByRole('textbox', { name: 'Name', exact: true });
    this.descriptionInput = root.getByRole('textbox', { name: 'Description' });
    this.externalIdInput = root.getByRole('textbox', { name: 'External ID' });
    this.nameRequiredError = root.getByText('Name is required');
  }

  /** One colour swatch, by the name screen readers announce, e.g. "vibrant purple". */
  colorSwatch(colorName: string): Locator {
    return this.root.getByRole('option', { name: colorName, exact: true });
  }

  /** Fill every field with `department`. */
  async fill(department: DepartmentData): Promise<void> {
    await this.nameInput.fill(department.name);
    await this.descriptionInput.fill(department.description);
    await this.colorSwatch(department.colorName).click();
    await this.externalIdInput.fill(department.externalId);
  }

  /** Check every field shows exactly `department`, including which colour is selected. */
  async expectValues(department: DepartmentData): Promise<void> {
    await expect(this.nameInput).toHaveValue(department.name);
    await expect(this.descriptionInput).toHaveValue(department.description);
    await expect(this.colorSwatch(department.colorName)).toHaveAttribute('aria-selected', 'true');
    await expect(this.externalIdInput).toHaveValue(department.externalId);
  }
}

/**
 * Clinic → Departments. Unlike Doctors and Treatments, departments are added and edited in
 * dialogs on the list page, not on a page of their own.
 */
export class DepartmentsPage extends ClinicListPage {
  readonly addDialog: DepartmentDialog;
  readonly editDialog: DepartmentDialog;
  readonly addDepartmentButton: Locator;
  readonly updateDepartmentButton: Locator;

  constructor(page: Page) {
    super(page, {
      listPath: '/departments',
      menuLinkName: 'Departments',
      addButtonName: 'Add department',
      rowActionsButtonName: 'Department actions',
      apiPath: ENDPOINTS.departments,
    });
    this.addDialog = new DepartmentDialog(page.getByRole('dialog', { name: 'Add Department' }));
    this.editDialog = new DepartmentDialog(page.getByRole('dialog', { name: 'Edit Department' }));
    this.addDepartmentButton = this.addDialog.root.getByRole('button', { name: 'Add Department' });
    this.updateDepartmentButton = this.editDialog.root.getByRole('button', { name: 'Update Department' });
  }

  /** Press "Add department" on the list page and wait for the empty dialog. */
  async openAddDialog(): Promise<void> {
    await this.addButton.click();
    await expect(this.addDialog.root).toBeVisible();
  }

  /** Press the dialog's "Add Department" button. */
  async submitAddDialog(): Promise<void> {
    await this.addDepartmentButton.click();
  }

  /**
   * Add a department through the dialog, starting from the list page.
   * @returns the new department's id, taken from the server's answer.
   */
  async createRecord(department: DepartmentData): Promise<string> {
    await this.openAddDialog();
    await this.addDialog.fill(department);
    // The list page doesn't change URL, so the id comes from the create response.
    const created = waitForApiResponse(this.page, 'POST', this.section.apiPath);
    await this.submitAddDialog();
    const response = await created;
    expect(response.status(), 'the server should create the department').toBe(201);
    await expect(this.addDialog.root).toBeHidden();
    return (await response.json()).data.id;
  }

  /** Open the Edit Department dialog of an existing department from the list. */
  async openEditDialog(name: string): Promise<void> {
    await this.chooseRowAction(name, 'Edit');
    await expect(this.editDialog.root).toBeVisible();
  }

  /** Reload the list, open the department, and check every field shows exactly `department`. */
  async expectSavedValues(department: DepartmentData): Promise<void> {
    // openEditDialog() reloads the list first, so the values come from the server.
    await this.openEditDialog(department.name);
    await this.editDialog.expectValues(department);
    await this.editDialog.root.getByRole('button', { name: 'Cancel' }).click();
  }

  /** Replace every field of an existing department with `updated` and save. */
  async editRecord(currentName: string, updated: DepartmentData): Promise<void> {
    await this.openEditDialog(currentName);
    await this.editDialog.fill(updated);
    const saved = waitForApiResponse(this.page, 'PATCH', this.recordApiPath());
    await this.updateDepartmentButton.click();
    expect((await saved).ok(), 'the server should accept the changes').toBe(true);
    await expect(this.editDialog.root).toBeHidden();
  }
}
