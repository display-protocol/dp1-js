import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (full.endsWith('.js') || full.endsWith('.mjs')) files.push(full);
  }
  return files;
}

for (const file of await walk('src')) {
  await execFileAsync(process.execPath, ['--check', file]);
}
for (const file of await walk('tests')) {
  await execFileAsync(process.execPath, ['--check', file]);
}
