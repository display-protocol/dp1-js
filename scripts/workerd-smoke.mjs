/**
 * End-to-end smoke test on the runtime that broke: Cloudflare's workerd.
 *
 * Builds the package, installs it into a throwaway Worker project, runs `wrangler dev --local`,
 * and asserts that building, validating, signing, and verifying a playlist all answer 200.
 * A Node test suite cannot catch what this catches:
 *
 *   - `new Function` is legal in Node, so the Ajv codegen failure behind #24
 *     (`Code generation from strings disallowed for this context`) only shows up here.
 *   - `node:*` resolves natively in Node. The Worker below is deliberately configured
 *     WITHOUT `nodejs_compat`, so any surviving `node:` import fails to link (#9). Adding the
 *     flag back would paper over exactly the regression this guards.
 *
 * Usage: `node scripts/workerd-smoke.mjs` (needs network access for the wrangler install).
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.WORKERD_SMOKE_PORT ?? 8799);
const wranglerVersion = process.env.WRANGLER_VERSION ?? '^4';

const WORKER_SOURCE = `import {
  ContractBuilder,
  PlaylistBuilder,
  PlaylistItemBuilder,
  ProvenanceBuilder,
  ParseAndValidatePlaylist,
  ValidateRefManifest,
  JcsTransform,
  SignMultiEd25519,
  VerifyPlaylistSignatures,
  PayloadHashString,
  PlaylistItemsFromDynamicQuery,
} from 'dp1-js';

// A raw 32-byte Ed25519 secret: the shape @noble takes, and the one a Worker can hold without
// node:crypto's KeyObject. Fixed so the smoke test is deterministic.
const SECRET_KEY = new Uint8Array(32).fill(7);

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

function item(standard) {
  return new PlaylistItemBuilder()
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
}

export default {
  fetch(request) {
    const { pathname } = new URL(request.url);

    // A rejection must still carry the { path, message } details consumers read.
    if (pathname === '/invalid') {
      try {
        new PlaylistBuilder().dpVersion('1.1.0').title('t').addItem(item('erc721a')).build();
      } catch (err) {
        return Response.json({ details: err.details, cause: String(err.cause?.message) });
      }
      return new Response('expected a validation error', { status: 500 });
    }

    // Formats are precompiled too; date-time must still be enforced.
    if (pathname === '/badformat') {
      try {
        ValidateRefManifest(
          JSON.stringify({ refVersion: '0.1.0', id: 'r', created: 'not-a-date', locale: 'en' })
        );
      } catch (err) {
        return Response.json({ details: err.details });
      }
      return new Response('expected a validation error', { status: 500 });
    }

    // Signing and verification, the paths that used to import node:crypto.
    if (pathname === '/sign') {
      return handleSign();
    }

    // The SSRF guard still runs its URL-level checks where no DNS resolver exists.
    if (pathname === '/ssrf') {
      return handleSsrf();
    }

    // build() validates against the derived unsigned variants; ParseAndValidate* the signed ones.
    const playlist = new PlaylistBuilder()
      .dpVersion('1.1.0')
      .title('t')
      .addItem(item('erc721'))
      .build();
    ParseAndValidatePlaylist(JSON.stringify({ ...playlist, signatures }));
    return Response.json(playlist);
  },
};

async function handleSign() {
  const playlist = new PlaylistBuilder()
    .dpVersion('1.1.0')
    .title('signed on workerd')
    .addItem(item('erc721'))
    .build();

  const raw = JSON.stringify(playlist);
  const sig = await SignMultiEd25519(raw, SECRET_KEY, 'agent', '2025-01-01T00:00:00Z');
  const signed = JSON.stringify({ ...playlist, signatures: [sig] });
  const [ok, failed] = VerifyPlaylistSignatures(signed);

  // A tampered document must fail, or "verification" proves nothing.
  const tampered = JSON.stringify({
    ...playlist,
    title: 'tampered',
    signatures: [sig],
  });
  const [tamperedOk] = VerifyPlaylistSignatures(tampered);

  return Response.json({
    ok,
    failed,
    tamperedOk,
    kid: sig.kid,
    alg: sig.alg,
    payloadHash: sig.payload_hash,
    // Canonicalization returns bytes that still answer .toString('utf8') without Buffer.
    jcs: JcsTransform('{"b":1,"a":2}').toString('utf8'),
    hashMatches: PayloadHashString(raw) === sig.payload_hash,
    uuid: typeof crypto.randomUUID() === 'string',
  });
}

async function handleSsrf() {
  const attempt = async endpoint => {
    try {
      await PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: 'https-json-v1',
          endpoint,
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        null
      );
      return 'allowed';
    } catch (err) {
      return err.message.split(':').slice(0, 2).join(':');
    }
  };
  return Response.json({
    loopback: await attempt('https://127.0.0.1/x'),
    linkLocal: await attempt('https://169.254.169.254/x'),
    insecure: await attempt('http://example.com/x'),
    ipv6Loopback: await attempt('https://[::1]/x'),
  });
}
`;

// Deliberately no `compatibility_flags = ["nodejs_compat"]`. With the flag, a leftover
// `node:crypto` import would resolve and hide the regression; without it, the Worker fails to
// link. That is the whole point of this file.
const WRANGLER_CONFIG = `name = "dp1-worker-smoke"
main = "src/index.js"
compatibility_date = "2026-06-24"
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status}):\n${result.stderr || result.stdout}`
    );
  }
  return result.stdout;
}

async function waitFor(url, logPath, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      // Any answer means workerd is serving; the assertions below judge the content.
      return response;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`wrangler dev never answered on ${url}\n${await readFile(logPath, 'utf8')}`);
}

function assert(condition, message, context) {
  if (!condition)
    throw new Error(`${message}${context ? `\n  got: ${JSON.stringify(context)}` : ''}`);
}

const sandbox = await mkdtemp(join(tmpdir(), 'dp1-js-workerd-'));
let wrangler;
try {
  console.log('workerd-smoke: building dp1-js');
  run('npm', ['run', 'build'], { cwd: repoRoot });

  console.log(`workerd-smoke: preparing Worker in ${sandbox}`);
  await mkdir(join(sandbox, 'src'), { recursive: true });
  await writeFile(join(sandbox, 'src/index.js'), WORKER_SOURCE, 'utf8');
  await writeFile(join(sandbox, 'wrangler.toml'), WRANGLER_CONFIG, 'utf8');
  await writeFile(
    join(sandbox, 'package.json'),
    `${JSON.stringify({ name: 'dp1-worker-smoke', private: true, type: 'module' }, null, 2)}\n`,
    'utf8'
  );

  run('npm', ['install', `wrangler@${wranglerVersion}`, repoRoot, '--no-audit', '--no-fund'], {
    cwd: sandbox,
  });

  const logPath = join(sandbox, 'wrangler.log');
  await writeFile(logPath, '', 'utf8');
  const { openSync } = await import('node:fs');
  const logFd = openSync(logPath, 'a');
  wrangler = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(port)], {
    cwd: sandbox,
    stdio: ['ignore', logFd, logFd],
    detached: true,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  });

  const base = `http://127.0.0.1:${port}`;
  await waitFor(base, logPath);

  const ok = await fetch(base);
  const playlist = await ok.json().catch(() => null);
  assert(
    ok.status === 200,
    `GET / returned ${ok.status}; expected the built playlist`,
    playlist ?? (await readFile(logPath, 'utf8')).slice(-2000)
  );
  assert(
    playlist?.dpVersion === '1.1.0' && playlist?.items?.length === 1,
    'unexpected playlist',
    playlist
  );
  console.log(`workerd-smoke: GET / -> 200 ${JSON.stringify(playlist)}`);

  const invalid = await (await fetch(`${base}/invalid`)).json();
  assert(invalid?.details?.[0]?.path === '/standard', 'rejection lost its details path', invalid);
  console.log(`workerd-smoke: GET /invalid -> ${JSON.stringify(invalid)}`);

  const badFormat = await (await fetch(`${base}/badformat`)).json();
  assert(badFormat?.details?.[0]?.path === '/created', 'format check did not run', badFormat);
  console.log(`workerd-smoke: GET /badformat -> ${JSON.stringify(badFormat)}`);

  const signResponse = await fetch(`${base}/sign`);
  const signed = await signResponse.json().catch(() => null);
  assert(
    signResponse.status === 200,
    `GET /sign returned ${signResponse.status}`,
    signed ?? (await readFile(logPath, 'utf8')).slice(-2000)
  );
  assert(signed?.ok === true && signed?.failed === null, 'signature did not verify', signed);
  assert(signed?.tamperedOk === false, 'a tampered document verified — check is vacuous', signed);
  assert(signed?.alg === 'ed25519', 'unexpected algorithm', signed);
  assert(String(signed?.kid).startsWith('did:key:z'), 'kid is not a did:key', signed);
  assert(signed?.hashMatches === true, 'payload hash disagrees with the signature', signed);
  assert(signed?.jcs === '{"a":2,"b":1}', 'JCS output lost its toString(utf8)', signed);
  assert(signed?.uuid === true, 'crypto.randomUUID() is unavailable', signed);
  console.log(`workerd-smoke: GET /sign -> ${JSON.stringify(signed)}`);

  const ssrf = await (await fetch(`${base}/ssrf`)).json();
  for (const [label, verdict] of Object.entries(ssrf)) {
    // Assert the endpoint-policy verdict specifically. `!== 'allowed'` would also pass on a
    // transport error, which would make this check quietly vacuous.
    assert(
      verdict === 'dynamicQuery: endpoint policy',
      `SSRF guard did not reject ${label} on policy grounds`,
      ssrf
    );
  }
  console.log(`workerd-smoke: GET /ssrf -> ${JSON.stringify(ssrf)}`);

  console.log('workerd-smoke: OK (no nodejs_compat)');
} finally {
  if (wrangler?.pid) {
    try {
      process.kill(-wrangler.pid, 'SIGTERM');
    } catch {
      wrangler.kill('SIGTERM');
    }
  }
  await rm(sandbox, { recursive: true, force: true });
}
