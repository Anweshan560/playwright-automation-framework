import { describeSettingsTableUi } from '../settingsTableSuite';
import { WEBSITES } from '../settingsTables';

// Create, edit and delete through the UI; the shared steps are in settingsTableSuite.ts.
describeSettingsTableUi(WEBSITES);
