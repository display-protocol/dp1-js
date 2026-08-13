import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  name: string;
  exports?: {
    '.': {
      types: string;
      import: string;
      require: string;
    };
  };
};

let built = false;

function ensureBuild() {
  if (built) return;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.equal(result.status, 0, result.stderr ?? result.stdout);
  built = true;
}

async function createConsumerSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), 'dp1-js-package-'));
  const nodeModules = join(sandbox, 'node_modules');
  await mkdir(nodeModules, { recursive: true });
  await symlink(repoRoot, join(nodeModules, packageJson.name), 'dir');
  return sandbox;
}

function runNode(args: string[], cwd: string) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
  });
}

test('package exports map points to build outputs', () => {
  assert.deepEqual(packageJson.exports?.['.'], {
    types: './dist/index.d.ts',
    import: './dist/index.js',
    require: './dist/index.cjs',
  });
});

// Runs a full `npm run build` before importing dist; CI + coverage can exceed the default 5s.
test('package root imports from ESM and CommonJS consumers', async () => {
  ensureBuild();
  const sandbox = await createConsumerSandbox();
  try {
    const esm = runNode(
      [
        '--input-type=module',
        '-e',
        `const mod = await import(${JSON.stringify(packageJson.name)}); if (typeof mod.parsePlaylist !== 'function') throw new Error('missing parsePlaylist'); if (typeof mod.ValidatePlaylist !== 'function') throw new Error('missing ValidatePlaylist'); if (typeof mod.ValidateRefManifest !== 'function') throw new Error('missing ValidateRefManifest'); if (typeof mod.NoteBuilder !== 'function') throw new Error('missing NoteBuilder'); if (typeof mod.PlaylistBuilder !== 'function' || typeof mod.ChannelBuilder !== 'function' || typeof mod.RefManifestBuilder !== 'function') throw new Error('missing document builders'); if (typeof mod.computeActiveSet !== 'function' || typeof mod.nextDisplayAt !== 'function' || typeof mod.parseDisplayAt !== 'function') throw new Error('missing displayAt helpers');`,
      ],
      sandbox
    );
    assert.equal(esm.status, 0, esm.stderr);

    const cjs = runNode(
      [
        '-e',
        `const mod = require(${JSON.stringify(packageJson.name)}); if (typeof mod.parsePlaylist !== 'function') throw new Error('missing parsePlaylist'); if (typeof mod.ValidatePlaylist !== 'function') throw new Error('missing ValidatePlaylist'); if (typeof mod.ValidateRefManifest !== 'function') throw new Error('missing ValidateRefManifest'); if (typeof mod.NoteBuilder !== 'function') throw new Error('missing NoteBuilder'); if (typeof mod.PlaylistBuilder !== 'function' || typeof mod.ChannelBuilder !== 'function' || typeof mod.RefManifestBuilder !== 'function') throw new Error('missing document builders'); if (typeof mod.computeActiveSet !== 'function' || typeof mod.nextDisplayAt !== 'function' || typeof mod.parseDisplayAt !== 'function') throw new Error('missing displayAt helpers');`,
      ],
      sandbox
    );
    assert.equal(cjs.status, 0, cjs.stderr);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}, 60_000);

// Regression guard for display-protocol/dp1-js#24. Ajv used to compile every schema with
// `new Function(...)` on first validation, which throws on runtimes that forbid dynamic
// codegen (Cloudflare Workers / workerd, Deno Deploy, CSP-restricted browsers) — a failure
// no ordinary Node run can reproduce. `--disallow-code-generation-from-strings` makes V8
// enforce the same rule here. The full workerd smoke test lives in
// `scripts/workerd-smoke.mjs`.
const NO_CODEGEN_SMOKE = `
import assert from 'node:assert/strict';
import {
  ContractBuilder,
  PlaylistBuilder,
  PlaylistItemBuilder,
  ProvenanceBuilder,
  ParseAndValidatePlaylist,
  ValidatePlaylist,
} from 'dp1-js';

assert.throws(() => new Function('return 1'), { name: 'EvalError' }, 'codegen should be blocked');

const item = (standard) =>
  new PlaylistItemBuilder()
    .source('https://cdn.example/artwork.html')
    .durationSeconds(30)
    .provenance(
      new ProvenanceBuilder().type('onChain').contract(
        new ContractBuilder()
          .chain('evm')
          .standard(standard)
          .address('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
          .tokenId('1')
      )
    );

// Builders validate unsigned (requireSignatures: false), so this covers the derived variants.
const playlist = new PlaylistBuilder().dpVersion('1.1.0').title('t').addItem(item('erc721')).build();
assert.equal(playlist.items.length, 1);

const signatures = [
  {
    alg: 'ed25519',
    kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    ts: '2025-01-01T00:00:00Z',
    payload_hash: 'sha256:' + 'a'.repeat(64),
    role: 'curator',
    sig: 'A'.repeat(86),
  },
];
ParseAndValidatePlaylist(JSON.stringify({ ...playlist, signatures }));
ValidatePlaylist(JSON.stringify({ ...playlist, signatures }));

// A rejection still carries the { path, message } details consumers read.
assert.throws(
  () => new PlaylistBuilder().dpVersion('1.1.0').title('t').addItem(item('erc721a')).build(),
  (err) => {
    assert.deepEqual(err.details, [
      { path: '/standard', message: 'must be equal to one of the allowed values' },
    ]);
    return true;
  }
);
`;

test('validation runs where code generation from strings is disallowed', async () => {
  ensureBuild();
  const sandbox = await createConsumerSandbox();
  try {
    const smoke = join(sandbox, 'no-codegen.mjs');
    await writeFile(smoke, NO_CODEGEN_SMOKE, 'utf8');
    const result = runNode(['--disallow-code-generation-from-strings', smoke], sandbox);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}, 60_000);
