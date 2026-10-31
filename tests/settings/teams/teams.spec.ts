import { describeSettingsTableUi } from '../settingsTableSuite';
import { TEAMS } from '../settingsTables';

// Create, edit and delete through the UI; the shared steps are in settingsTableSuite.ts.
describeSettingsTableUi(TEAMS);
