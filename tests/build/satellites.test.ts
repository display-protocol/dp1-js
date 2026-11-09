// Coverage for the Playlist Extension's `satellites[]` field (dp1#62, draft dp1#63 §3.8):
// a burn record, a memento run, a catalog or launch-party edition named on a parent
// playlist and rendered as a labeled section of its page. Pinned to dp1 commit 5273f88
// (claude/satellites-playlist-field-6a64b3, draft — not yet merged/tagged).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { PlaylistBuilder, PlaylistItemBuilder } from '../../src/build/index.js';
import {
  parsePlaylist,
  PlaylistDocument,
  ValidatePlaylistWithPlaylistsExtension,
  ValidateSatellite,
} from '../../src/index.js';
import { ErrValidation } from '../../src/errors.js';

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.cause === ErrValidation;
}

test('PlaylistBuilder carries satellites via addSatellite() and bulk satellites()', () => {
  const burn = { playlist: 'https://example.com/burn.json', kind: 'burn' };
  const playlist = new PlaylistBuilder()
    .title('T')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
    .addSatellite(burn)
    .build();
  assert.equal(playlist.satellites?.[0]?.playlist, burn.playlist);
  assert.equal(playlist.satellites?.[0]?.kind, 'burn');

  // .satellites() sets the whole list at once, instead of appending one at a time.
  const mementos = {
    playlist: 'https://example.com/mementos.json',
    kind: 'mementos',
    title: 'Mementos',
    note: 'Given out to attendees of the opening.',
  };
  const bulk = new PlaylistBuilder()
    .title('T')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
    .addSatellite(burn)
    .satellites([mementos])
    .build();
  assert.equal(bulk.satellites?.length, 1);
  assert.equal(bulk.satellites?.[0]?.title, 'Mementos');
  assert.equal(bulk.satellites?.[0]?.note, mementos.note);
});

test('Satellite requires playlist and kind; title/note length bounds are enforced', () => {
  assert.throws(
    () =>
      new PlaylistBuilder()
        .title('T')
        .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
        .addSatellite({ kind: 'burn' } as { playlist: string; kind: string })
        .build(),
    isValidationError
  );
  assert.throws(
    () =>
      new PlaylistBuilder()
        .title('T')
        .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
        .addSatellite({ playlist: 'https://example.com/burn.json' } as {
          playlist: string;
          kind: string;
        })
        .build(),
    isValidationError
  );
  assert.throws(
    () =>
      ValidateSatellite({
        playlist: 'https://example.com/burn.json',
        kind: 'burn',
        title: '',
      }),
    isValidationError
  );

  // kind is an open vocabulary (as contentRating and visibility are): any string validates.
  ValidateSatellite({ playlist: 'https://example.com/x.json', kind: 'from-a-later-vocabulary' });
});

test('satellites[] round-trips losslessly through JSON and the composed playlists-extension schema', () => {
  const p = {
    dpVersion: '1.1.0',
    id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
    title: 'T',
    created: '2026-01-01T00:00:00Z',
    items: [{ source: 'https://a' }],
    visibility: 'public',
    satellites: [
      { playlist: 'https://example.com/burn.json', kind: 'burn' },
      {
        playlist: 'https://example.com/launch-party.json',
        kind: 'launch-party',
        title: 'Launch Party Edition',
        note: 'Minted for guests at the opening night.',
      },
    ],
  };
  assert.deepEqual(parsePlaylist(p), p);
  assert.deepEqual(JSON.parse(JSON.stringify(new PlaylistDocument(p))), p);
  ValidatePlaylistWithPlaylistsExtension(p, { requireSignatures: false });
});
