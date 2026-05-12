import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
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

test('package root imports from ESM and CommonJS consumers', async () => {
  ensureBuild();
  const sandbox = await createConsumerSandbox();
  try {
    const esm = runNode(
      [
        '--input-type=module',
        '-e',
        `const mod = await import(${JSON.stringify(packageJson.name)}); if (typeof mod.parsePlaylist !== 'function') throw new Error('missing parsePlaylist');`,
      ],
      sandbox
    );
    assert.equal(esm.status, 0, esm.stderr);

    const cjs = runNode(
      [
        '-e',
        `const mod = require(${JSON.stringify(packageJson.name)}); if (typeof mod.parsePlaylist !== 'function') throw new Error('missing parsePlaylist');`,
      ],
      sandbox
    );
    assert.equal(cjs.status, 0, cjs.stderr);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
