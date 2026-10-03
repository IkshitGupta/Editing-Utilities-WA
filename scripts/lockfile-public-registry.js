// Rewrites package-lock.json so every package downloads from the public npm registry.
//
// Installs on a machine that uses a private npm mirror record the mirror's URLs in the
// lockfile. EAS cloud builds cannot reach such mirrors, so the lockfile must name
// registry.npmjs.org. The tarballs are identical, so the integrity hashes stay valid, and
// npm still downloads through the locally configured mirror because it swaps the
// registry.npmjs.org host for the configured registry.
//
// Usage: npm run lockfile:public
const fs = require('fs');
const path = require('path');

const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const lockPath = path.join(__dirname, '..', 'package-lock.json');

// Mirrors keep npm's "<name>/-/<file>.tgz" layout after their own prefix.
const MIRROR_PATTERN =
  /"resolved": "https?:\/\/(?!registry\.npmjs\.org\/)[^"]*?\/((?:@[^/"]+\/)?[^/"@]+\/-\/[^/"]+\.tgz)"/g;

const original = fs.readFileSync(lockPath, 'utf8');
let count = 0;
const rewritten = original.replace(MIRROR_PATTERN, (_match, tarballPath) => {
  count += 1;
  return `"resolved": "${PUBLIC_REGISTRY}${tarballPath}"`;
});

if (count > 0) {
  fs.writeFileSync(lockPath, rewritten);
}
console.log(
  count > 0
    ? `Pointed ${count} packages at ${PUBLIC_REGISTRY}`
    : 'package-lock.json already uses the public registry.'
);
