import { describeSettingsTableApi } from '../settingsTableSuite';
import { SAVED_FILES } from '../settingsTables';

// The endpoint's create, list, get, update, delete, validation and auth; shared steps in settingsTableSuite.ts.
describeSettingsTableApi(SAVED_FILES);
