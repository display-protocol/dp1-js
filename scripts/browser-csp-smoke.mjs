/**
 * End-to-end smoke test in a real browser under a strict Content-Security-Policy.
 *
 * Bundles the package for the browser, serves it from a page sent with
 * `Content-Security-Policy: script-src 'self'` — no `'unsafe-eval'` — and runs build, sign,
 * verify, and rejection inside Chromium.
 *
 * This is the case ordinary browser testing misses, and the one MV3 extensions live under.
 * Two failure modes only appear here:
 *
 *   - CSP without `'unsafe-eval'` makes `new Function` throw, which is what runtime schema
 *     compilation needed (#24). Chrome enforces this the same way workerd does.
 *   - A browser has no `Buffer`, no `process`, and no `node:*` resolution, so any surviving
 *     Node dependency fails at bundle time or at first use (#9).
 *
 * The bundle step alone is meaningful: `esbuild --platform=browser` refuses to resolve a
 * `node:` specifier, so a regression fails before Chromium even starts.
 *
 * Usage: `node scripts/browser-csp-smoke.mjs`. Needs Playwright's Chromium:
 *   npx playwright install --with-deps chromium
 */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.BROWSER_SMOKE_PORT ?? 8788);

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>dp1-js strict-CSP smoke</title>
<body><pre id="out">running…</pre><script type="module" src="/bundle.js"></script></body>
`;

// Runs inside the page. Every assertion here is a capability the library must keep in a
// browser: no Buffer, no process, no eval.
const TEST_SOURCE = `
import {
  ContractBuilder,
  PlaylistBuilder,
  PlaylistItemBuilder,
  ProvenanceBuilder,
  ParseAndValidatePlaylist,
  SignMultiEd25519,
  VerifyPlaylistSignatures,
  PayloadHashString,
  JcsTransform,
} from ${JSON.stringify(join(repoRoot, 'dist/index.js'))};

const results = {};
const check = (name, fn) => {
  try {
    results[name] = { ok: true, value: fn() };
  } catch (err) {
    results[name] = { ok: false, error: String(err && err.message || err) };
  }
};

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

async function run() {
  // The environment itself: prove this really is a browser with CSP in force.
  check('noBuffer', () => typeof Buffer === 'undefined');
  check('noProcess', () => typeof process === 'undefined');
  check('cspBlocksCodegen', () => {
    try {
      new Function('return 1');
      return false;
    } catch {
      return true;
    }
  });

  // build() validates against the derived unsigned schema variants.
  let playlist;
  check('build', () => {
    playlist = new PlaylistBuilder().dpVersion('1.1.0').title('t').addItem(item('erc721')).build();
    return playlist.items.length === 1 && typeof playlist.id === 'string';
  });

  check('randomUUID', () => typeof crypto.randomUUID() === 'string');
  check('jcs', () => JcsTransform('{"b":1,"a":2}').toString('utf8') === '{"a":2,"b":1}');

  // Signing and verification: the paths that used to require node:crypto.
  const raw = JSON.stringify(playlist);
  const key = new Uint8Array(32).fill(7);
  const sig = await SignMultiEd25519(raw, key, 'agent', '2025-01-01T00:00:00Z');

  check('sign', () => sig.alg === 'ed25519' && sig.kid.startsWith('did:key:z'));
  check('payloadHash', () => PayloadHashString(raw) === sig.payload_hash);
  check('verify', () => {
    const [ok, failed] = VerifyPlaylistSignatures(JSON.stringify({ ...playlist, signatures: [sig] }));
    return ok === true && failed === null;
  });
  check('rejectsTampered', () => {
    const [ok] = VerifyPlaylistSignatures(
      JSON.stringify({ ...playlist, title: 'tampered', signatures: [sig] })
    );
    return ok === false;
  });

  // Validation must still reject, and still carry usable details.
  check('parseAndValidate', () => {
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
    return true;
  });
  check('rejectionDetails', () => {
    try {
      new PlaylistBuilder().dpVersion('1.1.0').title('t').addItem(item('erc721a')).build();
      return false;
    } catch (err) {
      return JSON.stringify(err.details) ===
        JSON.stringify([{ path: '/standard', message: 'must be equal to one of the allowed values' }]);
    }
  });

  return results;
}

run().then(
  r => { window.__dp1Result = r; },
  err => { window.__dp1Result = { fatal: { ok: false, error: String(err && err.stack || err) } }; }
);
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

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw new Error(
      'browser-csp-smoke: playwright is not installed.\n' +
        '  npm i -D playwright && npx playwright install --with-deps chromium'
    );
  }
}

const sandbox = await mkdtemp(join(tmpdir(), 'dp1-js-browser-'));
let server;
let browser;
try {
  console.log('browser-csp-smoke: building dp1-js');
  run('npm', ['run', 'build'], { cwd: repoRoot });

  // `--platform=browser` is itself an assertion: esbuild refuses to resolve `node:` builtins,
  // so this step fails outright if a Node import comes back.
  console.log('browser-csp-smoke: bundling for the browser');
  const entry = join(sandbox, 'entry.mjs');
  const bundle = join(sandbox, 'bundle.js');
  await import('node:fs/promises').then(fs => fs.writeFile(entry, TEST_SOURCE, 'utf8'));
  run(
    'npx',
    [
      'esbuild',
      entry,
      '--bundle',
      '--platform=browser',
      '--format=esm',
      '--target=es2022',
      `--outfile=${bundle}`,
      '--log-level=warning',
    ],
    { cwd: repoRoot }
  );

  const bundleSource = await readFile(bundle, 'utf8');
  if (/(?:^|[^.\w])(?:require|import)\s*\(\s*["']node:/.test(bundleSource)) {
    throw new Error('browser bundle still imports a node: builtin');
  }

  const chromium = await loadChromium();

  server = createServer((req, res) => {
    if (req.url === '/bundle.js') {
      res.writeHead(200, {
        'Content-Type': 'text/javascript',
        // No 'unsafe-eval': this is the MV3 / strict-CSP condition.
        'Content-Security-Policy': "default-src 'self'; script-src 'self'",
      });
      res.end(bundleSource);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'",
    });
    res.end(PAGE);
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  console.log(`browser-csp-smoke: serving http://127.0.0.1:${port} with script-src 'self'`);

  browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', err => consoleErrors.push(String(err)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dp1Result !== undefined, null, { timeout: 30_000 });
  const results = await page.evaluate(() => window.__dp1Result);

  const failures = Object.entries(results).filter(([, r]) => !r.ok || r.value === false);
  for (const [name, result] of Object.entries(results)) {
    console.log(
      `browser-csp-smoke: ${failures.some(([f]) => f === name) ? 'FAIL' : 'ok  '} ${name}` +
        (result.error ? ` — ${result.error}` : '')
    );
  }
  if (failures.length) {
    throw new Error(
      `browser-csp-smoke: ${failures.length} check(s) failed:\n${JSON.stringify(results, null, 2)}` +
        (consoleErrors.length ? `\nconsole:\n${consoleErrors.join('\n')}` : '')
    );
  }

  // A CSP violation would surface here even if the checks above happened to pass.
  const cspViolations = consoleErrors.filter(text => /Content Security Policy/i.test(text));
  if (cspViolations.length) {
    throw new Error(`browser-csp-smoke: CSP violations reported:\n${cspViolations.join('\n')}`);
  }

  console.log("browser-csp-smoke: OK (Chromium, script-src 'self', no unsafe-eval)");
} finally {
  await browser?.close();
  await new Promise(resolve => (server ? server.close(resolve) : resolve()));
  await rm(sandbox, { recursive: true, force: true });
}
