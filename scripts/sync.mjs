import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvg } from './build.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--source') {
  throw new Error('Usage: npm run sync -- --source /path/to/fedora-icons');
}
const sourceRoot = path.resolve(args[1]);
const rawManifest = await readFile(path.join(sourceRoot, 'manifest.json'), 'utf8');
const manifest = JSON.parse(rawManifest);
if (
  manifest.schemaVersion !== 1 || manifest.grid !== 24 || manifest.license !== 'MIT'
  || JSON.stringify(manifest.styles) !== '["regular","filled","duocolor","duotone"]'
  || manifest.iconCount !== manifest.icons.length
) throw new Error('Unsupported or inconsistent canonical manifest');

const digest = value => createHash('sha256').update(value).digest('hex');
const icons = [];
for (const icon of manifest.icons) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon.name)) throw new Error(`Invalid name: ${icon.name}`);
  const svg = {};
  for (const style of manifest.styles) {
    const relative = `icons/${style}/${icon.name}.svg`;
    if (icon.files[style] !== relative) throw new Error(`Unexpected source path: ${relative}`);
    svg[style] = await readFile(path.join(sourceRoot, relative), 'utf8');
    if (digest(svg[style]) !== icon.sha256[style]) throw new Error(`Source digest mismatch: ${relative}`);
    parseSvg(svg[style], relative);
  }
  icons.push({ name: icon.name, sha256: icon.sha256, svg });
}
const snapshot = JSON.stringify({
  schemaVersion: 1,
  grid: manifest.grid,
  license: manifest.license,
  styles: manifest.styles,
  iconCount: icons.length,
  excludedBrands: manifest.source.excludedBrands,
  icons,
}) + '\n';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
  cwd: sourceRoot, encoding: 'utf8',
}).trim());
await mkdir(path.join(packageRoot, 'source'), { recursive: true });
await writeFile(path.join(packageRoot, 'source/icons.json'), snapshot);
await writeFile(path.join(packageRoot, 'source/lock.json'), JSON.stringify({
  repository: 'fedora-icons/fedora-icons',
  revision,
  dirty,
  manifestSha256: digest(rawManifest),
  snapshotSha256: digest(snapshot),
}, null, 2) + '\n');
await copyFile(path.join(sourceRoot, 'LICENSE'), path.join(packageRoot, 'LICENSE'));
console.log(`Synchronized ${icons.length} icons from ${revision}${dirty ? ' (includes local changes)' : ''}.`);
