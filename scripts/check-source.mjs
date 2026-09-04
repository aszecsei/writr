#!/usr/bin/env node
// Source hygiene checks that biome does not cover. Run by `npm run lint`.
//
//   node scripts/check-source.mjs           fail on any violation
//   node scripts/check-source.mjs --update  rewrite the cast baseline from the tree
//
// Checks:
//   1. No NUL (U+0000) bytes in source. grep and ripgrep treat such files as
//      binary and silently skip them, which hides code from every audit.
//   2. No CommonJS `require(` in ESM source.
//   3. `as unknown as` double casts may not grow: each file's count must stay
//      at or below scripts/cast-baseline.json, and new files start at zero.
//      Lowering a count is fine; run with --update after you remove casts.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const roots = ["src", "collab/src"];
const baselinePath = "scripts/cast-baseline.json";
const update = process.argv.includes("--update");
const NUL = String.fromCharCode(0);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(name)) yield path;
  }
}

const files = roots
  .flatMap((r) => [...walk(r)])
  .map((p) => p.split(sep).join("/"));
const baseline = update ? {} : JSON.parse(readFileSync(baselinePath, "utf8"));
const errors = [];
const casts = {};

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes(NUL)) errors.push(`${file}: contains a NUL byte`);
  if (!/\.test\.[tj]sx?$/.test(file) && /\brequire\(/.test(text)) {
    errors.push(`${file}: uses require(); this is an ESM codebase`);
  }
  const count = (text.match(/\bas unknown as\b/g) ?? []).length;
  if (count > 0) casts[file] = count;
  const allowed = baseline[file] ?? 0;
  if (!update && count > allowed) {
    errors.push(
      `${file}: ${count} "as unknown as" cast(s), baseline allows ${allowed}. Type the value instead, or run with --update if the cast is justified.`,
    );
  }
}

if (update) {
  const sorted = Object.fromEntries(
    Object.entries(casts).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`wrote ${baselinePath} (${Object.keys(sorted).length} files)`);
  process.exit(0);
}

const stale = Object.keys(baseline).filter((f) => !(f in casts));
if (stale.length) {
  console.log(
    `note: ${stale.length} baseline entr${stale.length === 1 ? "y" : "ies"} no longer ha${stale.length === 1 ? "s" : "ve"} casts; run --update to tighten: ${stale.map((f) => relative(".", f)).join(", ")}`,
  );
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`check-source: ${files.length} files ok`);
