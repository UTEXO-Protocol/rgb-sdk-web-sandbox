// Build snapshots of the sibling checkouts. npm ci then needs no sibling paths.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = path.join(root, 'vendor');
mkdirSync(vendor, { recursive: true });
const snapshots = [];
const packageFile = path.join(root, 'package.json');
const appPackage = JSON.parse(readFileSync(packageFile, 'utf8'));
for (const repo of ['rgb-sdk-core', 'rgb-sdk', 'rgb-sdk-web']) {
  const cwd = path.resolve(root, '..', repo);
  const run = (bin, args) => execFileSync(bin, args, { cwd, encoding: 'utf8' }).trim();
  execFileSync('npm', ['run', 'build'], { cwd, stdio: 'inherit' });
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', vendor]));
  appPackage.dependencies[packed.name] = `file:vendor/${packed.filename}`;
  snapshots.push({
    repository: repo,
    commit: run('git', ['rev-parse', 'HEAD']),
    workingTreeChanges: run('git', ['status', '--porcelain']).split('\n').filter(Boolean),
    name: packed.name,
    version: packed.version,
    file: packed.filename,
    sha256: createHash('sha256').update(readFileSync(path.join(vendor, packed.filename))).digest('hex'),
  });
}
writeFileSync(packageFile, JSON.stringify(appPackage, null, 2) + '\n');
writeFileSync(path.join(vendor, 'sdk-snapshots.json'), JSON.stringify(snapshots, null, 2) + '\n');
console.log('SDK snapshots updated. Run npm install --force to refresh installed packages and lockfile integrity.');
