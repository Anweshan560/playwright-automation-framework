import { describeSettingsTableApi } from '../settingsTableSuite';
import { TEAMS } from '../settingsTables';

// The endpoint's create, list, get, update, delete, validation and auth; shared steps in settingsTableSuite.ts.
describeSettingsTableApi(TEAMS);
