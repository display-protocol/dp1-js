import { ErrorCode, withCode } from '../errors.js';
import {
  PlaylistItem as ValidatePlaylistItem,
  PlaylistsExtensionFragment as ValidatePlaylistsExtensionFragment,
} from '../validate/index.js';
import { assertKebabSlug, assertSemver, assertUri } from './helpers.js';
import type {
  Channel,
  DynamicQuery,
  Entity,
  Note,
  Playlist,
  PlaylistGroup,
  PlaylistItem,
} from './types.js';

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`dp1: ${fieldName} must be a non-empty string`);
  }
}

function assertIsoDateTime(value: unknown, fieldName: string): void {
  if (typeof value !== 'string') throw new Error(`dp1: ${fieldName} must be an ISO 8601 timestamp`);
  const t = Date.parse(value);
  if (!Number.isFinite(t)) throw new Error(`dp1: ${fieldName} must be an ISO 8601 timestamp`);
}

export function validateNoteDraft(note: Note): void {
  assertNonEmptyString(note.text, 'note.text');
  if (note.text.length > 500) throw new Error('dp1: note.text must be <= 500 chars');
  if (note.duration !== undefined) {
    if (typeof note.duration !== 'number' || !(note.duration > 0))
      throw new Error('dp1: note.duration must be > 0');
  }
}

export function validateEntityDraft(entity: Entity): void {
  assertNonEmptyString(entity.name, 'entity.name');
  assertNonEmptyString(entity.key, 'entity.key');
  if (!/^did:[a-z]+:.+$/.test(entity.key)) throw new Error('dp1: entity.key must be a DID');
  if (entity.url !== undefined) assertUri(entity.url, 'entity.url');
}

export function validateDynamicQueryDraft(q: DynamicQuery): void {
  assertNonEmptyString(q.profile, 'dynamicQuery.profile');
  if (q.profile !== 'https-json-v1' && q.profile !== 'graphql-v1') {
    throw new Error('dp1: dynamicQuery.profile must be https-json-v1 or graphql-v1');
  }
  assertUri(q.endpoint, 'dynamicQuery.endpoint');
  assertNonEmptyString(q.responseMapping?.itemsPath, 'dynamicQuery.responseMapping.itemsPath');
  assertNonEmptyString(q.responseMapping?.itemSchema, 'dynamicQuery.responseMapping.itemSchema');
  if (!/^dp1\/\d+\.\d+$/.test(q.responseMapping.itemSchema))
    throw new Error('dp1: dynamicQuery.responseMapping.itemSchema must look like dp1/1.1');
  if (q.method !== undefined && q.method !== 'GET' && q.method !== 'POST') {
    throw new Error('dp1: dynamicQuery.method must be GET or POST');
  }
}

export function validatePlaylistItemDraft(item: PlaylistItem): void {
  // AJV validates the core playlist item schema thoroughly.
  ValidatePlaylistItem(Buffer.from(JSON.stringify(item)));
  if (item.note) validateNoteDraft(item.note);
}

export function validatePlaylistDraft(doc: Playlist): void {
  assertNonEmptyString(doc.dpVersion, 'dpVersion');
  assertSemver(doc.dpVersion, 'dpVersion');
  assertNonEmptyString(doc.title, 'title');
  if (doc.title.length > 200) throw new Error('dp1: title must be <= 200 chars');
  if (doc.slug !== undefined) assertKebabSlug(doc.slug, 'slug');
  if (doc.created !== undefined) assertIsoDateTime(doc.created, 'created');

  if (!Array.isArray(doc.items)) throw new Error('dp1: items must be an array');
  for (const it of doc.items) validatePlaylistItemDraft(it);

  const hasExtensionFields =
    doc.note !== undefined ||
    doc.curators !== undefined ||
    doc.summary !== undefined ||
    doc.coverImage !== undefined ||
    doc.dynamicQuery !== undefined;

  // Core playlists require items; extension playlists may use empty items only with dynamicQuery.
  if (doc.items.length === 0 && !doc.dynamicQuery) {
    throw new Error('dp1: dynamicQuery is required when items is empty');
  }

  if (doc.dynamicQuery) validateDynamicQueryDraft(doc.dynamicQuery);
  if (doc.note) validateNoteDraft(doc.note);
  if (doc.curators) doc.curators.forEach(validateEntityDraft);
  if (doc.coverImage) assertUri(doc.coverImage, 'coverImage');
  if (doc.summary !== undefined) {
    assertNonEmptyString(doc.summary, 'summary');
    if (doc.summary.length > 2000) throw new Error('dp1: summary must be <= 2000 chars');
  }

  if (hasExtensionFields) {
    // Validate extension fragment shape when extension fields are present.
    ValidatePlaylistsExtensionFragment(
      Buffer.from(
        JSON.stringify({
          note: doc.note,
          items: doc.items.map(it => ({ note: it.note })),
          curators: doc.curators,
          summary: doc.summary,
          coverImage: doc.coverImage,
          dynamicQuery: doc.dynamicQuery,
        })
      )
    );
  }
}

export function validatePlaylistGroupDraft(doc: PlaylistGroup): void {
  assertNonEmptyString(doc.id, 'id');
  assertNonEmptyString(doc.title, 'title');
  if (doc.title.length > 200) throw new Error('dp1: title must be <= 200 chars');
  if (doc.slug !== undefined) assertKebabSlug(doc.slug, 'slug');
  assertIsoDateTime(doc.created, 'created');
  if (!Array.isArray(doc.playlists) || doc.playlists.length < 1)
    throw new Error('dp1: playlists must be a non-empty array');
  for (const p of doc.playlists) assertUri(p, 'playlists[]');
  if (doc.coverImage) assertUri(doc.coverImage, 'coverImage');
}

export function validateChannelDraft(doc: Channel): void {
  assertNonEmptyString(doc.id, 'id');
  assertNonEmptyString(doc.slug, 'slug');
  assertKebabSlug(doc.slug, 'slug');
  assertNonEmptyString(doc.title, 'title');
  if (doc.title.length > 200) throw new Error('dp1: title must be <= 200 chars');
  assertNonEmptyString(doc.version, 'version');
  assertSemver(doc.version, 'version');
  assertIsoDateTime(doc.created, 'created');
  if (!Array.isArray(doc.playlists) || doc.playlists.length < 1)
    throw new Error('dp1: playlists must be a non-empty array');
  for (const p of doc.playlists) assertUri(p, 'playlists[]');
  if (doc.coverImage) assertUri(doc.coverImage, 'coverImage');
  if (doc.curators) doc.curators.forEach(validateEntityDraft);
  if (doc.publisher) validateEntityDraft(doc.publisher);
}

export function asPlaylistInvalid(err: unknown): unknown {
  return withCode(ErrorCode.PlaylistInvalid, err);
}

export function asPlaylistGroupInvalid(err: unknown): unknown {
  return withCode(ErrorCode.PlaylistGroupInvalid, err);
}

export function asChannelInvalid(err: unknown): unknown {
  return withCode(ErrorCode.ChannelInvalid, err);
}
