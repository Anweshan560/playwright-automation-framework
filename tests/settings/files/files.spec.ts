import { describeSettingsTableUi } from '../settingsTableSuite';
import { SAVED_FILES } from '../settingsTables';

// Create, edit and delete through the UI; the shared steps are in settingsTableSuite.ts.
describeSettingsTableUi(SAVED_FILES);
