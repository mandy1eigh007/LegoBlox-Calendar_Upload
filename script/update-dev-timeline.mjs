#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const repoRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..');
const docsPath = path.join(repoRoot, 'docs', 'DEV_TIMELINE.md');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function readLastSha(content) {
  const m = content.match(/<!--\s*LAST_SHA:\s*([0-9a-f]{7,40})\s*-->/i);
  return m ? m[1] : null;
}

function formatEntry(commit) {
  const { sha, date, subject, body, files, insertions, deletions } = commit;
  const dt = new Date(date);
  const local = dt.toLocaleString();
  const filesList = files.map(f => `- ${f}`).join('\n');
  return `## ${local}\nCommit: ${sha}\nMessage: ${subject}\nFiles:\n${filesList}\nStats: +${insertions} -${deletions}\nNotes: ${body || ''}\n\n`;
}

function parseNameStatus(output) {
  // Lines like: A\tpath or R100\told\tnew
  const lines = output.split('\n').filter(Boolean);
  const files = lines.map(line => {
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R')) {
      const oldp = parts[1] || '';
      const newp = parts[2] || '';
      return `R ${oldp} -> ${newp}`;
    }
    const code = status[0];
    const p = parts[1] || parts[0];
    return `${code} ${p}`;
  });
  return files;
}

function parseShortStat(output) {
  // Example: 1 file changed, 2 insertions(+), 3 deletions(-)
  const ins = (output.match(/(\d+) insertions?\(\+\)/) || [0,0])[1] || 0;
  const del = (output.match(/(\d+) deletions?\(-\)/) || [0,0])[1] || 0;
  return { insertions: Number(ins), deletions: Number(del) };
}

function main() {
  const exists = fs.existsSync(docsPath);
  const cur = exists ? fs.readFileSync(docsPath, 'utf8') : '';
  const lastSha = readLastSha(cur);

  let shas = [];
  if (lastSha) {
    // get commits after lastSha
    try {
      const out = run(`git rev-list --reverse ${lastSha}..HEAD`);
      shas = out ? out.split('\n').filter(Boolean) : [];
    } catch (e) {
      console.error('git rev-list failed', e.message);
      process.exit(1);
    }
  } else {
    // all history
    const out = run('git rev-list --reverse --all');
    shas = out ? out.split('\n').filter(Boolean) : [];
  }

  if (shas.length === 0) {
    console.log('No new commits to append.');
    process.exit(0);
  }

  const entries = [];
  for (const sha of shas) {
    // get metadata
    const show = run(`git show -s --format=%H%x01%ci%x01%s%x01%b ${sha}`);
    const [h, date, subject, body] = show.split('\x01');

    const nameStatus = run(`git show --name-status --format= --no-patch ${sha}`);
    const files = parseNameStatus(nameStatus);

    const shortstat = run(`git show --shortstat --format= --no-patch ${sha}`);
    const { insertions, deletions } = parseShortStat(shortstat);

    entries.push({ sha: h, date, subject, body: body ? body.trim() : '', files, insertions, deletions });
  }

  // Append entries to file
  let outContent = cur;
  // If marker missing, add marker at top
  if (!readLastSha(outContent)) {
    const marker = '<!-- LAST_SHA: -->\n\n';
    outContent = marker + outContent;
  }

  // Append in order
  for (const e of entries) {
    outContent += formatEntry(e);
  }

  // Update LAST_SHA to last processed sha
  const lastProcessed = entries[entries.length - 1].sha;
  outContent = outContent.replace(/<!--\s*LAST_SHA:\s*[0-9a-f]{7,40}\s*-->/i, `<!-- LAST_SHA: ${lastProcessed} -->`);

  fs.writeFileSync(docsPath, outContent, 'utf8');
  console.log(`Appended ${entries.length} commits. LAST_SHA set to ${lastProcessed}`);
}

main();
