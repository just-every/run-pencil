import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
function insideRepository(path) {
  for (let current = path; ; current = dirname(current)) {
    if (current === root || existsSync(join(current, '.git'))) return true;
    if (current === dirname(current)) return false;
  }
}
export function privateArchivePath(path) {
  const absolute = resolve(path);
  // Check both the spelling and resolved parents, including symlinks into any
  // checkout. Refuse before reading an archive or creating an output.
  const parent = realpathSync(dirname(absolute));
  // The command contract keeps local transfer paths in the checkout. Its
  // ignored private export directory is outside the reset/source inventory.
  const exports = join(root, 'exports');
  const inExports = path => path.startsWith(exports + '/');
  if ((insideRepository(dirname(absolute)) || insideRepository(parent)) && !(inExports(absolute) && inExports(parent + '/'))) throw Object.assign(new Error('Archives must be outside repositories or in this checkout’s ignored exports directory, including resolved parents.'), { recoveryCode: 'PRIVATE_PATH_REQUIRED' });
  if (existsSync(absolute)) {
    const physical = realpathSync(absolute);
    if (lstatSync(absolute).isSymbolicLink() || (insideRepository(dirname(physical)) && !inExports(physical))) throw Object.assign(new Error('Archive symlinks are not accepted.'), { recoveryCode: 'PRIVATE_PATH_REQUIRED' });
  }
  return absolute;
}
