import { describeSettingsTableApi } from '../settingsTableSuite';
import { CLOSING_NOTES } from '../settingsTables';

// The endpoint's create, list, get, update, delete, validation and auth; shared steps in settingsTableSuite.ts.
describeSettingsTableApi(CLOSING_NOTES);
