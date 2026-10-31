import { describeSettingsTableApi } from '../settingsTableSuite';
import { SNIPPETS } from '../settingsTables';

// The endpoint's create, list, get, update, delete, validation and auth; shared steps in settingsTableSuite.ts.
describeSettingsTableApi(SNIPPETS);
