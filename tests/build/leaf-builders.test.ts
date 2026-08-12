import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ArtistBuilder,
  ControlsBuilder,
  DependencyBuilder,
  DisplayControlsBuilder,
  DisplayPrefsBuilder,
  EntityBuilder,
  EngineVersionBuilder,
  FrameHashBuilder,
  InteractionBuilder,
  MetadataBuilder,
  MouseInteractionBuilder,
  ProvenanceBuilder,
  ContractBuilder,
  DynamicQueryBuilder,
  ResponseMappingBuilder,
  ReproBuilder,
  SafetyControlsBuilder,
  ThumbnailBuilder,
  NoteBuilder,
} from '../../src/build/index.js';
import { ErrValidation } from '../../src/errors.js';
import {
  DynamicQuery as ValidateDynamicQuery,
  Playlist as ValidatePlaylist,
} from '../../src/validate/index.js';

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.cause === ErrValidation;
}

test('DisplayPrefsBuilder rejects short hex colors on build()', () => {
  assert.throws(() => new DisplayPrefsBuilder().background('#111').build(), isValidationError);
  assert.doesNotThrow(() => new DisplayPrefsBuilder().background('#111111').build());
});

test('EntityBuilder enforces DID key', () => {
  assert.throws(() => new EntityBuilder().name('A').key('nope').build(), isValidationError);
  assert.doesNotThrow(() => new EntityBuilder().name('A').key('did:key:z6Mk').build());
});

test('ProvenanceBuilder requires contract for onChain', () => {
  assert.throws(() => new ProvenanceBuilder().type('onChain').build(), isValidationError);
  assert.doesNotThrow(() =>
    new ProvenanceBuilder()
      .type('onChain')
      .contract(new ContractBuilder().chain('evm').standard('erc721'))
      .build()
  );
});

test('ProvenanceBuilder validates plain-object dependencies on build()', () => {
  assert.throws(
    () =>
      new ProvenanceBuilder()
        .type('offChainURI')
        .dependencies([{ uri: 'not-a-uri' }])
        .build(),
    isValidationError
  );
});

test('DynamicQueryBuilder validates responseMapping.itemSchema pattern', () => {
  assert.throws(
    () =>
      new DynamicQueryBuilder()
        .profile('graphql-v1')
        .endpoint('https://idx.example/gql')
        .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('nope'))
        .build(),
    isValidationError
  );
  assert.doesNotThrow(() =>
    new DynamicQueryBuilder()
      .profile('graphql-v1')
      .endpoint('https://idx.example/gql')
      .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('dp1/1.1'))
      .build()
  );
});

test('ValidateDynamicQuery rejects unknown profile', () => {
  assert.throws(
    () =>
      ValidateDynamicQuery({
        profile: 'nope',
        endpoint: 'https://idx.example/gql',
        responseMapping: { itemsPath: 'data.items', itemSchema: 'dp1/1.1' },
      }),
    isValidationError
  );
});

test('ThumbnailBuilder enforces uri and validates dimensions when present', () => {
  assert.throws(
    () => new ThumbnailBuilder().uri('x').widthPx(0).heightPx(10).build(),
    isValidationError
  );
  assert.doesNotThrow(() =>
    new ThumbnailBuilder().uri('https://example.com/x.png').widthPx(10).heightPx(10).build()
  );
});

test('ThumbnailBuilder omits unset dimensions rather than guessing', () => {
  const bare = new ThumbnailBuilder().uri('https://example.com/x.png').build();
  assert.equal(bare.w, undefined);
  assert.equal(bare.h, undefined);
  assert.deepEqual(Object.keys(bare), ['uri']);

  // One dimension alone is still valid: w and h are independently optional.
  const widthOnly = new ThumbnailBuilder().uri('https://example.com/x.png').widthPx(320).build();
  assert.deepEqual(Object.keys(widthOnly), ['uri', 'w']);
});

test('ReproBuilder rejects uppercase hex and validates plain frameHash', () => {
  assert.throws(() => new ReproBuilder().seedHex('0xABCDEF').build(), isValidationError);
  assert.throws(
    () =>
      new ReproBuilder()
        .frameHash({
          sha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
        .build(),
    isValidationError
  );
  assert.doesNotThrow(() =>
    new ReproBuilder()
      .seedHex('0xabcdef')
      .frameHash({
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
      .build()
  );
});

test('ControlsBuilder validates plain-object display scaling', () => {
  assert.throws(
    () =>
      new ControlsBuilder().display({ scaling: 'nope' as 'fit', background: '#111111' }).build(),
    isValidationError
  );
});

test('DisplayPrefsBuilder does not coerce non-boolean mouse flags', () => {
  assert.throws(
    () =>
      new DisplayPrefsBuilder()
        .interaction({ mouse: { click: 'yes' as unknown as boolean } })
        .build(),
    isValidationError
  );
});

test('NoteBuilder enforces text length and duration', () => {
  assert.throws(() => new NoteBuilder().text('x'.repeat(501)).build(), isValidationError);
  assert.throws(() => new NoteBuilder().text('ok').durationSeconds(0).build(), isValidationError);
  assert.doesNotThrow(() => new NoteBuilder().text('ok').durationSeconds(20).build());
});

test('ValidatePlaylist rejects empty items without signatures option path', () => {
  assert.throws(
    () =>
      ValidatePlaylist(
        Buffer.from(JSON.stringify({ dpVersion: '1.1.0', title: 'Empty', items: [] })),
        {
          requireSignatures: false,
        }
      ),
    isValidationError
  );
});

test('Display builders cover prefs, controls, and interaction setters', () => {
  const mouse = new MouseInteractionBuilder()
    .click(true)
    .scroll(false)
    .drag(true)
    .hover(false)
    .build();
  assert.deepEqual(mouse, { click: true, scroll: false, drag: true, hover: false });

  const prefs = new DisplayPrefsBuilder()
    .scaling('fit')
    .margin('10px')
    .background('#111111')
    .autoplay(true)
    .loop(false)
    .interaction(
      new InteractionBuilder().keyboard(['Space']).mouse(new MouseInteractionBuilder().click(true))
    )
    .userOverride('scaling', true)
    .build();
  assert.equal(prefs.scaling, 'fit');
  assert.equal(prefs.userOverrides?.scaling, true);
  assert.deepEqual(prefs.interaction?.keyboard, ['Space']);

  const controls = new DisplayControlsBuilder()
    .scaling('fill')
    .margin(8)
    .background('transparent')
    .autoplay(false)
    .loop(true)
    .interaction({ keyboard: ['Esc'] })
    .build();
  assert.equal(controls.scaling, 'fill');
  assert.deepEqual(controls.interaction?.keyboard, ['Esc']);
  assert.throws(
    () => new DisplayPrefsBuilder().scaling('nope' as 'fit').build(),
    isValidationError
  );
});

test('EntityBuilder accepts url and NoteBuilder omits duration', () => {
  const entity = new EntityBuilder()
    .name('Ada')
    .key('did:key:z6Mk')
    .url('https://example.com/ada')
    .build();
  assert.equal(entity.url, 'https://example.com/ada');

  const note = new NoteBuilder().text('ok').build();
  assert.equal(note.text, 'ok');
  assert.equal(note.duration, undefined);
});

test('DynamicQueryBuilder covers method headers query and itemMap', () => {
  const withHeader = new DynamicQueryBuilder()
    .profile('https-json-v1')
    .endpoint('https://idx.example/items')
    .method('GET')
    .header('Accept', 'application/json')
    .queryTemplate('?limit=10')
    .responseMapping(
      new ResponseMappingBuilder()
        .itemsPath('items')
        .itemSchema('dp1/1.1')
        .itemMap({ id: 'id', source: 'url' })
    )
    .build();
  assert.equal(withHeader.method, 'GET');
  assert.equal(withHeader.headers?.Accept, 'application/json');
  assert.equal(withHeader.query, '?limit=10');
  assert.deepEqual(withHeader.responseMapping.itemMap, { id: 'id', source: 'url' });

  const withHeaders = new DynamicQueryBuilder()
    .profile('graphql-v1')
    .endpoint('https://idx.example/gql')
    .method('POST')
    .headers({ 'X-A': '1' })
    .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('dp1/1.1'))
    .build();
  assert.equal(withHeaders.headers?.['X-A'], '1');
});

test('Provenance Contract and Dependency builders cover optional fields', () => {
  const dep = new DependencyBuilder()
    .chain('evm')
    .standard('erc721')
    .uri('https://dep.example')
    .build();
  const prov = new ProvenanceBuilder()
    .type('onChain')
    .contract(
      new ContractBuilder()
        .chain('evm')
        .standard('erc721')
        .address('0xabc')
        .seriesId(1)
        .tokenId('42')
        .uri('https://meta.example')
        .metaHashSha256Hex('a'.repeat(64))
    )
    .addDependency(dep)
    .build();
  assert.equal(prov.contract?.address, '0xabc');
  assert.equal(prov.contract?.metaHash, 'a'.repeat(64));
  assert.equal(prov.dependencies?.length, 1);
  assert.throws(() => new DependencyBuilder().uri('not-a-uri').build(), isValidationError);
});

test('ReproBuilder covers engineVersion FrameHash and assets', () => {
  const repro = new ReproBuilder()
    .engineVersion(new EngineVersionBuilder().chromium('120').webkit('17').gecko('121'))
    .seedHex('0xabcdef')
    .assetsSha256Hex(['a'.repeat(64)])
    .frameHash(new FrameHashBuilder().sha256Hex('b'.repeat(64)).phashHex('0xdead'))
    .build();
  assert.equal(repro.engineVersion?.chromium, '120');
  assert.equal(repro.assetsSHA256?.length, 1);
  assert.equal(repro.frameHash?.phash, '0xdead');
  assert.doesNotThrow(() => new EngineVersionBuilder().build());
  assert.doesNotThrow(() => new FrameHashBuilder().build());
});

test('Ref-manifest leaf builders cover metadata artist safety and thumbnails', () => {
  const thumb = new ThumbnailBuilder()
    .uri('https://example.com/t.png')
    .widthPx(10)
    .heightPx(10)
    .sha256Hex('a'.repeat(64))
    .build();
  assert.equal(thumb.sha256, 'a'.repeat(64));

  const meta = new MetadataBuilder()
    .title('T')
    .creditLine('C')
    .description('D')
    .tags(['a'])
    .addArtist(new ArtistBuilder().name('Ada').id('ada').url('https://ada.example'))
    .thumbnails({ sm: thumb })
    .build();
  assert.equal(meta.artists?.length, 1);
  assert.equal(meta.artists?.[0]?.name, 'Ada');
  assert.ok(meta.thumbnails?.sm);

  const bulkArtists = new MetadataBuilder().artists([new ArtistBuilder().name('Bob')]).build();
  assert.equal(bulkArtists.artists?.[0]?.name, 'Bob');

  const safety = new SafetyControlsBuilder()
    .orientation(['landscape'])
    .maxCpuPct(50)
    .maxMemMB(512)
    .build();
  const controls = new ControlsBuilder()
    .display(new DisplayControlsBuilder().scaling('fit'))
    .safety(safety)
    .build();
  assert.equal(controls.safety?.maxCpuPct, 50);
  assert.throws(() => new ArtistBuilder().name('Ada').url('not-a-url').build(), isValidationError);
});
