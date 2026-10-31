/**
 * What each Settings table page tells the shared tests in settingsTableSuite.ts:
 * how to build its test data, map it to the API, and what the app answers.
 */
import { defineSettingsTable } from './settingsTableSuite';
import {
  ClosingNotesApi,
  SavedFilesApi,
  SnippetsApi,
  TagsApi,
  TeamsApi,
  WebsitesApi,
  toClosingNotePayload,
  toSavedFilePayload,
  toSnippetPayload,
  toTagPayload,
  toTeamPayload,
  toWebsitePayload,
} from '../../api/SettingsApis';
import { ApiKeysApi, toApiKeyPayload } from '../../api/DeveloperApi';
import { ApiKeysPage } from '../../pages/settings/ApiKeysPage';
import { ClosingNotesPage } from '../../pages/settings/ClosingNotesPage';
import { SavedFilesPage } from '../../pages/settings/SavedFilesPage';
import { SnippetsPage } from '../../pages/settings/SnippetsPage';
import { TagsPage } from '../../pages/settings/TagsPage';
import { TeamsPage } from '../../pages/settings/TeamsPage';
import { WebsitesPage } from '../../pages/settings/WebsitesPage';
import {
  buildApiKey,
  buildClosingNote,
  buildSavedFile,
  buildSnippet,
  buildTag,
  buildTeam,
  buildWebsite,
} from '../../utils/testData';

export const WEBSITES = defineSettingsTable({
  title: 'Websites',
  singular: 'website',
  tags: ['@settings', '@websites'],
  createPage: (page) => new WebsitesPage(page),
  createApi: (request, headers) => new WebsitesApi(request, headers),
  build: () => buildWebsite(),
  toPayload: toWebsitePayload,
  // The confirmation names the website by its domain: Delete "qa-acme-123.example.com"?
  deleteConfirmation: (website) => `"${website.domain}"`,
  requiredFieldErrors: { domain: 'domain should not be empty', name: 'name should not be empty' },
  notFoundMessage: 'Website not found',
});

export const TEAMS = defineSettingsTable({
  title: 'Teams',
  singular: 'team',
  tags: ['@settings', '@teams'],
  createPage: (page, workspaceId) => new TeamsPage(page, workspaceId),
  createApi: (request, headers, workspaceId) => new TeamsApi(request, headers, workspaceId),
  build: (current) => buildTeam(current),
  toPayload: toTeamPayload,
  deleteConfirmation: (team) => team.name,
  // App bug: an empty name is reported as "too long". Reported; this documents today's answer.
  requiredFieldErrors: { name: 'name must be shorter than or equal to 100 characters' },
  notFoundMessage: 'Team not found',
});

export const TAGS = defineSettingsTable({
  title: 'Tags',
  singular: 'tag',
  tags: ['@settings', '@tags'],
  createPage: (page) => new TagsPage(page),
  createApi: (request, headers) => new TagsApi(request, headers),
  build: (current) => buildTag(current),
  toPayload: toTagPayload,
  deleteConfirmation: (tag) => tag.name,
  requiredFieldErrors: { name: 'name should not be empty', color: 'color should not be empty' },
  notFoundMessage: 'No such tag',
});

export const CLOSING_NOTES = defineSettingsTable({
  title: 'Closing Notes',
  singular: 'closing note',
  tags: ['@settings', '@closing-notes'],
  createPage: (page) => new ClosingNotesPage(page),
  createApi: (request, headers) => new ClosingNotesApi(request, headers),
  build: () => buildClosingNote(),
  toPayload: toClosingNotePayload,
  deleteConfirmation: (note) => note.category,
  requiredFieldErrors: { category: 'category should not be empty' },
  notFoundMessage: 'No closing note found',
});

export const SNIPPETS = defineSettingsTable({
  title: 'Snippets',
  singular: 'snippet',
  tags: ['@settings', '@snippets'],
  createPage: (page) => new SnippetsPage(page),
  createApi: (request, headers) => new SnippetsApi(request, headers),
  build: (current) => buildSnippet(current),
  toPayload: toSnippetPayload,
  deleteConfirmation: (snippet) => snippet.name,
  requiredFieldErrors: { name: 'name must be a string', content: 'content must be a string' },
  notFoundMessage: 'No snippet found',
});

export const SAVED_FILES = defineSettingsTable({
  title: 'Files',
  singular: 'saved file',
  tags: ['@settings', '@files'],
  createPage: (page) => new SavedFilesPage(page),
  createApi: (request, headers) => new SavedFilesApi(request, headers),
  build: () => buildSavedFile(),
  toPayload: toSavedFilePayload,
  // Through the UI the app uploads the image and stores its own URL, so check the name and type.
  storedFields: (file) => ({ name: file.name, type: 'image' }),
  deleteConfirmation: (file) => file.name,
  requiredFieldErrors: {
    name: 'name must be a string',
    url: 'url must be a string',
    type: 'type must be one of the following values: image, video, audio, file, iframe, sticker',
  },
  notFoundMessage: 'No saved file found',
});

export const API_KEYS = defineSettingsTable({
  title: 'API Keys',
  singular: 'API key',
  tags: ['@settings', '@api-keys'],
  createPage: (page) => new ApiKeysPage(page),
  createApi: (request, headers) => new ApiKeysApi(request, headers),
  build: () => buildApiKey(),
  toPayload: toApiKeyPayload,
  deleteConfirmation: (apiKey) => apiKey.name,
  requiredFieldErrors: { name: 'name should not be empty' },
  notFoundMessage: 'No such API key',
});
