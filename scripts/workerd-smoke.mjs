/**
 * End-to-end smoke test on the runtime that broke: Cloudflare's workerd.
 *
 * Builds the package, installs it into a throwaway Worker project, runs `wrangler dev --local`,
 * and asserts that building + validating a playlist answers 200 instead of
 * `Code generation from strings disallowed for this context` (display-protocol/dp1-js#24).
 * A Node test suite cannot catch this: `new Function` is legal in Node.
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
} from 'dp1-js';

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
`;

const WRANGLER_CONFIG = `name = "dp1-worker-smoke"
main = "src/index.js"
compatibility_date = "2026-06-24"
compatibility_flags = ["nodejs_compat"]
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

  console.log('workerd-smoke: OK');
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
