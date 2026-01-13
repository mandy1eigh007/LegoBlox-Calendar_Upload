#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const repoRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..');
const outPath = path.join(repoRoot, 'docs', 'WORKING_TREE_SNAPSHOT.md');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function main() {
  const timestamp = new Date().toLocaleString();
  const status = run('git status --porcelain');
  const diffstat = run('git diff --stat');

  const out = `# Working Tree Snapshot\n\nTimestamp: ${timestamp}\n\n## git status --porcelain\n\n```
  + '\n' + (status || '(clean)') + '\n```
\n## git diff --stat\n\n```
\n' + (diffstat || '(no changes)') + '\n```
`;

  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`Wrote working tree snapshot to ${outPath}`);
}

main();
