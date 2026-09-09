import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  name: string;
  sideEffects?: unknown;
  exports?: {
    '.': {
      import: { types: string; default: string };
      require: { types: string; default: string };
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

// Each condition carries its own `types`. A single `types` above the conditions hands the ESM
// declaration file to `require` consumers too, and with `"type": "module"` TypeScript reads it as
// ESM and rejects it from CommonJS (TS1479 under moduleResolution: node16). See #30.
test('package exports map points to build outputs', () => {
  assert.deepEqual(packageJson.exports?.['.'], {
    import: { types: './dist/index.d.ts', default: './dist/index.js' },
    require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
  });
});

// `"sideEffects": false` is what lets a bundler drop the ~853 KB validator chunk for a consumer
// that only parses or builds documents. The field is only truthful while nothing in `src/` runs at
// import time: `src/sign/index.ts` used to call `RegisterVerifier` twice at module scope, and a
// bundler licensed to drop those statements while keeping the exports that read the registry gave
// the consumer `dp1: signature algorithm not implemented: "ed25519"` on the first signature it
// checked. Registration is lazy now, so the claim holds — and this test fails if the
// module-scope form comes back.
test('package declares itself free of side effects', () => {
  assert.equal(packageJson.sideEffects, false);
  const sign = readFileSync(join(repoRoot, 'src/sign/index.ts'), 'utf8');
  assert.doesNotMatch(
    sign,
    /^RegisterVerifier\(/m,
    'module-scope verifier registration would make "sideEffects": false a false claim'
  );
});

// The built-in verifiers now register on the first read of the registry rather than at import.
// Exercised against the built package, from a consumer that registers nothing, because that is the
// shape the old module-scope call was protecting.
const LAZY_REGISTRATION = `
import assert from 'node:assert/strict';
import { GetVerifier, SupportedAlgorithms } from 'dp1-js';

assert.equal(GetVerifier('ed25519').alg(), 'ed25519');
assert.equal(GetVerifier('eip191').alg(), 'eip191');
assert.equal(GetVerifier('ED25519').alg(), 'ed25519');
assert.deepEqual(SupportedAlgorithms(), ['ed25519', 'eip191']);
assert.throws(() => GetVerifier('ecdsa-p256'), /not implemented/);
`;

// Precedence, both orderings. A consumer's verifier wins whether it is registered before the
// defaults are materialized or after — the same guarantee module-scope registration gave, where
// every consumer call necessarily landed after the defaults.
const CONSUMER_PRECEDENCE = `
import assert from 'node:assert/strict';
import { GetVerifier, RegisterVerifier, SupportedAlgorithms } from 'dp1-js';

// Registered before the first read: the default must not overwrite it.
const early = { alg: () => 'ed25519', verifySignature() {} };
RegisterVerifier(early);
assert.equal(GetVerifier('ed25519'), early);
// ...and the defaults for other algorithms still fill in.
assert.equal(GetVerifier('eip191').alg(), 'eip191');

// Registered after the first read: overwrites the default, as before.
const late = { alg: () => 'eip191', verifySignature() {} };
RegisterVerifier(late);
assert.equal(GetVerifier('eip191'), late);

// A new algorithm joins the registry.
RegisterVerifier({ alg: () => 'ecdsa-p256', verifySignature() {} });
assert.equal(GetVerifier('ecdsa-p256').alg(), 'ecdsa-p256');
assert.deepEqual(SupportedAlgorithms(), ['ecdsa-p256', 'ed25519', 'eip191']);
`;

test('built-in verifiers register on first use, and a consumer still wins', async () => {
  ensureBuild();
  const sandbox = await createConsumerSandbox();
  try {
    for (const [name, source] of [
      ['lazy-registration.mjs', LAZY_REGISTRATION],
      ['consumer-precedence.mjs', CONSUMER_PRECEDENCE],
    ] as const) {
      const script = join(sandbox, name);
      await writeFile(script, source, 'utf8');
      const result = runNode([script], sandbox);
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}, 60_000);

// The point of the field, proved rather than asserted. A distinctive literal from the Ajv
// standalone validators (`scripts/generate-validators.mjs` emits it ~86 times) stands in for the
// validator chunk: if tree-shaking works, a parse-only consumer's bundle does not contain it.
const VALIDATOR_MARKER = 'must be equal to one of the allowed values';

test('a parse-only consumer tree-shakes the validator chunk away', async () => {
  ensureBuild();
  const { build } = await import('esbuild');
  const sandbox = await createConsumerSandbox();
  try {
    let n = 0;
    const bundle = async (source: string) => {
      const entry = join(sandbox, `entry-${n++}.mjs`);
      await writeFile(entry, source, 'utf8');
      const result = await build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'node',
        treeShaking: true,
        write: false,
        absWorkingDir: sandbox,
        logLevel: 'silent',
      });
      return result.outputFiles[0].text;
    };

    // `parsePlaylist` and the schedule helpers, but no builder: `build()` schema-validates, so
    // every `*Builder` legitimately pulls the validators in and is not a parse-only import.
    const parseOnly = await bundle(
      `import { parsePlaylist, computeActiveSet, JcsTransform } from 'dp1-js';\nglobalThis.keep = [parsePlaylist, computeActiveSet, JcsTransform];\n`
    );
    const validating = await bundle(
      `import { ValidatePlaylist } from 'dp1-js';\nglobalThis.keep = [ValidatePlaylist];\n`
    );

    assert.equal(
      parseOnly.includes(VALIDATOR_MARKER),
      false,
      'parse-only bundle still carries the validators'
    );
    assert.equal(
      validating.includes(VALIDATOR_MARKER),
      true,
      'a validating consumer must still get the validators'
    );
    // Measured on this change: ~10 KB parse-only against ~835 KB validating. The bounds sit an
    // order of magnitude clear of both, so ordinary growth does not fail them, but a regression
    // that re-links the validator chunk does.
    assert.ok(
      parseOnly.length < 100_000,
      `parse-only bundle is ${parseOnly.length} bytes, expected well under 100 KB`
    );
    assert.ok(
      validating.length > 500_000,
      `validating bundle is ${validating.length} bytes, expected the validators to be present`
    );

    // The failure #33 withheld the field over, run rather than reasoned about: a signature-verifying
    // consumer, bundled with tree-shaking on and then executed. Under module-scope registration
    // this is where the bundle threw `signature algorithm not implemented: "ed25519"`. The other
    // assertions in this file cannot catch it — they either grep source, or run under plain Node
    // where no bundler has dropped anything.
    const verifying = await bundle(`
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { SignMultiEd25519, VerifyMultiSignature, SupportedAlgorithms } from 'dp1-js';

const { privateKey } = generateKeyPairSync('ed25519');
const raw = Buffer.from('{"dpVersion":"1.1.0","title":"t","items":[{"source":"https://example.com"}]}');
const sig = await SignMultiEd25519(raw, privateKey, 'curator', '2025-01-01T00:00:00Z');
assert.equal(sig.alg, 'ed25519');
// Nothing registered a verifier: the bundle has to materialize the default on its own.
assert.doesNotThrow(() => VerifyMultiSignature(raw, sig));
assert.deepEqual(SupportedAlgorithms(), ['ed25519', 'eip191']);
`);
    assert.equal(
      verifying.includes(VALIDATOR_MARKER),
      false,
      'a sign-only consumer should not carry the validators either'
    );
    const verifyScript = join(sandbox, 'verify.bundle.mjs');
    await writeFile(verifyScript, verifying, 'utf8');
    const ran = runNode([verifyScript], sandbox);
    assert.equal(ran.status, 0, `bundled verifier failed: ${ran.stderr}`);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}, 60_000);

// Guards the other half of #30: the map is only correct while the build still emits both
// declaration flavors. A tsup/format change that drops `.d.cts` would leave `require` consumers
// pointing at a file that does not exist.
test('build emits every file the exports map names', () => {
  ensureBuild();
  const root = packageJson.exports?.['.'];
  assert.ok(root);
  for (const target of [
    root.import.types,
    root.import.default,
    root.require.types,
    root.require.default,
  ]) {
    assert.ok(existsSync(join(repoRoot, target)), `missing build output: ${target}`);
  }
}, 60_000);

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
// codegen (Cloudflare Workers / workerd) — a failure no ordinary Node run can reproduce.
// `--disallow-code-generation-from-strings` makes V8 enforce the same rule here. The full
// workerd smoke test lives in `scripts/workerd-smoke.mjs`.
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
