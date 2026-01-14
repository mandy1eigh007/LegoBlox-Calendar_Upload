#!/usr/bin/env node
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repoRoot = two levels up from /script
const repoRoot = path.resolve(__dirname, "..");
const docsPath = path.join(repoRoot, "docs", "DEV_TIMELINE.md");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function readLastSha(content) {
  const m = content.match(/<!--\s*LAST_SHA:\s*([0-9a-f]{7,40})\s*-->/i);
  return m ? m[1] : null;
}

function formatEntry(commit) {
  const { sha, date, subject, body, files, insertions, deletions } = commit;
  const dt = new Date(date);
  const local = dt.toLocaleString();
  const filesList = files.length ? files.map((f) => `- ${f}`).join("\n") : "- (none)";
  return `## ${local}
Commit: ${sha}
Message: ${subject}
Files:
${filesList}
Stats: +${insertions} -${deletions}
Notes: ${body || ""}

`;
}

function parseNameStatus(output) {
  const lines = output.split("\n").filter(Boolean);
  return lines.map((line) => {
    const parts = line.split("\t");
    const status = parts[0] || "";
    if (status.startsWith("R")) {
      const oldp = parts[1] || "";
      const newp = parts[2] || "";
      return `R ${oldp} -> ${newp}`;
    }
    const code = status[0] || "?";
    const p = parts[1] || parts[0] || "";
    return `${code} ${p}`;
  });
}

function parseShortStat(output) {
  const ins = (output.match(/(\d+)\s+insertions?\(\+\)/) || [0, 0])[1] || 0;
  const del = (output.match(/(\d+)\s+deletions?\(-\)/) || [0, 0])[1] || 0;
  return { insertions: Number(ins), deletions: Number(del) };
}

function ensureHeader(cur) {
  // Always ensure the marker exists and is replaceable
  const hasAnyMarker = /<!--\s*LAST_SHA:/i.test(cur);
  if (hasAnyMarker) return cur;
  return "<!-- LAST_SHA: -->\n\n" + cur;
}

function setLastSha(content, sha) {
  // Replace marker whether empty or already set
  if (/<!--\s*LAST_SHA:\s*[0-9a-f]{7,40}\s*-->/i.test(content)) {
    return content.replace(
      /<!--\s*LAST_SHA:\s*[0-9a-f]{7,40}\s*-->/i,
      `<!-- LAST_SHA: ${sha} -->`
    );
  }
  return content.replace(/<!--\s*LAST_SHA:\s*-->/i, `<!-- LAST_SHA: ${sha} -->`);
}

function main() {
  // Ensure docs folder exists
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });

  const exists = fs.existsSync(docsPath);
  const cur = exists ? fs.readFileSync(docsPath, "utf8") : "";
  const withHeader = ensureHeader(cur);
  const lastSha = readLastSha(withHeader);

  let shas = [];
  if (lastSha) {
    const out = run(`git rev-list --reverse ${lastSha}..HEAD`);
    shas = out ? out.split("\n").filter(Boolean) : [];
  } else {
    const out = run("git rev-list --reverse --all");
    shas = out ? out.split("\n").filter(Boolean) : [];
  }

  if (shas.length === 0) {
    fs.writeFileSync(docsPath, withHeader, "utf8");
    console.log("No new commits to append.");
    process.exit(0);
  }

  const entries = [];
  for (const sha of shas) {
    const show = run(`git show -s --format=%H%x01%ci%x01%s%x01%b ${sha}`);
    const [h, date, subject, body] = show.split("\x01");

    const nameStatus = run(`git show --name-status --format= --no-patch ${sha}`);
    const files = parseNameStatus(nameStatus);

    const shortstat = run(`git show --shortstat --format= --no-patch ${sha}`);
    const { insertions, deletions } = parseShortStat(shortstat);

    entries.push({
      sha: h,
      date,
      subject,
      body: body ? body.trim() : "",
      files,
      insertions,
      deletions,
    });
  }

  let outContent = withHeader;
  for (const e of entries) outContent += formatEntry(e);

  const lastProcessed = entries[entries.length - 1].sha;
  outContent = setLastSha(outContent, lastProcessed);

  fs.writeFileSync(docsPath, outContent, "utf8");
  console.log(`Appended ${entries.length} commits. LAST_SHA set to ${lastProcessed}`);
}

main();