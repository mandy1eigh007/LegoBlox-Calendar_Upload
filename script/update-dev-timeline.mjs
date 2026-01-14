#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const docsDir = path.join(repoRoot, "docs");
const docsPath = path.join(docsDir, "DEV_TIMELINE.md");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function readLastSha(content) {
  const m = content.match(/<!--\s*LAST_SHA:\s*([0-9a-f]{7,40})\s*-->/i);
  return m ? m[1] : null;
}

function ensureMarker(content) {
  // If marker missing, add a placeholder that WILL be replaced later.
  if (/<!--\s*LAST_SHA:/i.test(content)) return content;
  return `<!-- LAST_SHA: 0000000 -->\n\n${content}`;
}

function formatEntry(commit) {
  const { sha, epoch, subject, body, files, insertions, deletions } = commit;

  // Stable UTC timestamp for clean diffs.
  const isoUtc = new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", " UTC");

  const filesList = files.length ? files.map((f) => `- ${f}`).join("\n") : "- (no file changes)";
  const notes = body ? body.trim() : "";

  return (
    `## ${isoUtc}\n` +
    `Commit: ${sha}\n` +
    `Message: ${subject}\n` +
    `Files:\n${filesList}\n` +
    `Stats: +${insertions} -${deletions}\n` +
    `Notes: ${notes}\n\n`
  );
}

function parseNameStatus(output) {
  // Lines like: M\tpath, A\tpath, D\tpath, R100\told\tnew, C100\told\tnew
  const lines = output.split("\n").filter(Boolean);

  return lines.map((line) => {
    const parts = line.split("\t");
    const status = parts[0] || "";

    if (status.startsWith("R") || status.startsWith("C")) {
      const oldp = parts[1] || "";
      const newp = parts[2] || "";
      const code = status[0]; // R or C
      return `${code} ${oldp} -> ${newp}`;
    }

    const code = status[0] || "?";
    const p = parts[1] || "";
    return `${code} ${p}`.trim();
  });
}

function parseShortStat(output) {
  // Example: " 1 file changed, 2 insertions(+), 3 deletions(-)"
  const ins = (output.match(/(\d+)\s+insertions?\(\+\)/) || [0, 0])[1] || 0;
  const del = (output.match(/(\d+)\s+deletions?\(-\)/) || [0, 0])[1] || 0;
  return { insertions: Number(ins), deletions: Number(del) };
}

function updateMarker(content, lastProcessedSha) {
  // Replace marker whether it currently has a SHA or not.
  return content.replace(
    /<!--\s*LAST_SHA:\s*([0-9a-f]{7,40})?\s*-->/i,
    `<!-- LAST_SHA: ${lastProcessedSha} -->`
  );
}

function main() {
  const exists = fs.existsSync(docsPath);
  const cur = exists ? fs.readFileSync(docsPath, "utf8") : "";
  const lastSha = readLastSha(cur);

  let shas = [];
  if (lastSha) {
    try {
      const out = run(`git rev-list --reverse ${lastSha}..HEAD`);
      shas = out ? out.split("\n").filter(Boolean) : [];
    } catch (e) {
      // If history got rewritten (rebase/squash), fall back to full history
      const out = run("git rev-list --reverse --all");
      shas = out ? out.split("\n").filter(Boolean) : [];
    }
  } else {
    const out = run("git rev-list --reverse --all");
    shas = out ? out.split("\n").filter(Boolean) : [];
  }

  if (shas.length === 0) {
    console.log("No new commits to append.");
    process.exit(0);
  }

  const entries = [];
  for (const sha of shas) {
    // Use epoch seconds for reliable parsing.
    const show = run(`git show -s --format=%H%x01%ct%x01%s%x01%b ${sha}`);
    const [h, epochStr, subject, body] = show.split("\x01");
    const epoch = Number(epochStr);

    const nameStatus = run(`git show --name-status --format= --no-patch ${sha}`);
    const files = parseNameStatus(nameStatus);

    const shortstat = run(`git show --shortstat --format= --no-patch ${sha}`);
    const { insertions, deletions } = parseShortStat(shortstat);

    entries.push({
      sha: h,
      epoch,
      subject,
      body: body ? body.trim() : "",
      files,
      insertions,
      deletions,
    });
  }

  let outContent = ensureMarker(cur);

  for (const e of entries) {
    outContent += formatEntry(e);
  }

  const lastProcessed = entries[entries.length - 1].sha;
  outContent = updateMarker(outContent, lastProcessed);

  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(docsPath, outContent, "utf8");

  console.log(`Appended ${entries.length} commits. LAST_SHA set to ${lastProcessed}`);
}

main();