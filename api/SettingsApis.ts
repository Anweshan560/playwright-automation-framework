/**
 * Clients for the Settings pages built on SettingsTablePage. Each is a ResourceApi with its path,
 * plus functions that convert between the dialog's test data and the API's field names.
 */
import type { APIRequestContext } from '@playwright/test';
import { ENDPOINTS, ResourceApi, type HeadersProvider } from './ResourceApi';
import {
  TAG_COLORS,
  TEAM_STRATEGIES,
  type ClosingNoteData,
  type SavedFileData,
  type SnippetData,
  type TagColorName,
  type TagData,
  type TeamData,
  type WebsiteData,
} from '../utils/testData';

/** Every record has an id; the tests only read the fields they send. */
type WithId<T> = T & { id: string };

// --- Websites ---------------------------------------------------------------------------------

export type WebsitePayload = { domain?: string; name?: string };

export function toWebsitePayload(website: WebsiteData): WebsitePayload {
  return { domain: website.domain, name: website.name };
}

export class WebsitesApi extends ResourceApi<WebsitePayload, WithId<Required<WebsitePayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.websites);
  }
}

// --- Teams ------------------------------------------------------------------------------------

export type TeamPayload = { name?: string; color?: string; assignmentStrategy?: string };

export function toTeamPayload(team: TeamData): TeamPayload {
  return { name: team.name, color: team.color, assignmentStrategy: team.strategy.value };
}

/** Convert an API team back to dialog data, to check it in the UI. */
export function toTeamData(team: WithId<Required<TeamPayload>>): TeamData {
  const strategy = TEAM_STRATEGIES.find((option) => option.value === team.assignmentStrategy);
  if (!strategy) throw new Error(`Unknown assignment strategy "${team.assignmentStrategy}"`);
  return { name: team.name, color: team.color as TeamData['color'], strategy };
}

export class TeamsApi extends ResourceApi<TeamPayload, WithId<Required<TeamPayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider, workspaceId: string) {
    super(request, headers, ENDPOINTS.teams(workspaceId));
  }
}

// --- Tags -------------------------------------------------------------------------------------

export type TagPayload = { name?: string; color?: string; scopes?: string[] };

/** Tags created in Settings are scoped to the inbox, like the dialog's default. */
export function toTagPayload(tag: TagData): TagPayload {
  return { name: tag.name, color: TAG_COLORS[tag.colorName], scopes: ['inbox'] };
}

/** Convert an API tag back to dialog data, to check it in the UI. */
export function toTagData(tag: WithId<Required<TagPayload>>): TagData {
  const colorName = (Object.keys(TAG_COLORS) as TagColorName[]).find(
    (name) => TAG_COLORS[name] === tag.color,
  );
  if (!colorName) throw new Error(`${tag.color} is not one of the dialog's colour presets`);
  return { name: tag.name, colorName };
}

export class TagsApi extends ResourceApi<TagPayload, WithId<Required<TagPayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.tags, 'PUT');
  }
}

// --- Closing notes ----------------------------------------------------------------------------

/** The dialog's "Summary" is stored as `description`. */
export type ClosingNotePayload = { category?: string; description?: string };

export function toClosingNotePayload(note: ClosingNoteData): ClosingNotePayload {
  return { category: note.category, description: note.summary };
}

export class ClosingNotesApi extends ResourceApi<ClosingNotePayload, WithId<Required<ClosingNotePayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.closingNotes);
  }
}

// --- Snippets ---------------------------------------------------------------------------------

/** The dialog's Visibility "Only me" is stored as `isPrivate: true`. */
export type SnippetPayload = { name?: string; content?: string; isPrivate?: boolean };

export function toSnippetPayload(snippet: SnippetData): SnippetPayload {
  return { name: snippet.name, content: snippet.content, isPrivate: snippet.visibility === 'Only me' };
}

/** Convert an API snippet back to dialog data, to check it in the UI. */
export function toSnippetData(snippet: WithId<Required<SnippetPayload>>): SnippetData {
  return {
    name: snippet.name,
    content: snippet.content,
    visibility: snippet.isPrivate ? 'Only me' : 'Everyone',
  };
}

export class SnippetsApi extends ResourceApi<SnippetPayload, WithId<Required<SnippetPayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.snippets);
  }
}

// --- Saved files ------------------------------------------------------------------------------

/**
 * The app uploads the file first and then saves its URL. API tests skip the upload and point at
 * an example.com address, which is enough to test the saved-file record itself.
 */
export type SavedFilePayload = { name?: string; url?: string; type?: string };

export function toSavedFilePayload(file: SavedFileData): SavedFilePayload {
  return {
    name: file.name,
    url: `https://example.com/qa/${encodeURIComponent(file.name)}.png`,
    type: 'image',
  };
}

export class SavedFilesApi extends ResourceApi<SavedFilePayload, WithId<Required<SavedFilePayload>>> {
  constructor(request: APIRequestContext, headers: HeadersProvider) {
    super(request, headers, ENDPOINTS.savedFiles);
  }
}
