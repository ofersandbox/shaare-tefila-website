// CHECK 3: after publishing, make sure the live website really shows what was
// just built. Usage:  node tests/live-check.mjs https://example.github.io/site/
//
// It compares the live "Life at Shaare Tefila" section with the one in this
// copy of the site, and checks that its photos load. GitHub Pages can take a
// minute to update, so it tries a few times before reporting a problem.

import { readFile } from "node:fs/promises";
import { notifyFailure } from "../build/lib/notify.mjs";

const base = (process.argv[2] || process.env.LIVE_URL || "").replace(/\/?$/, "/");
if (!base.startsWith("http")) {
  console.error("Give the live site's address, e.g. node tests/live-check.mjs https://example.github.io/site/");
  process.exit(2);
}

const SECTION_PATH = "sections/home/04-life-at-shaare-tefila.html";
const expected = await readFile(new URL(`../${SECTION_PATH}`, import.meta.url), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check() {
  const problems = [];
  const home = await fetch(base, { cache: "no-store" });
  if (!home.ok) problems.push(`The home page returned an error (${home.status}).`);
  const res = await fetch(base + SECTION_PATH, { cache: "no-store" });
  const live = res.ok ? await res.text() : "";
  if (!res.ok) problems.push(`The Life at Shaare Tefila section returned an error (${res.status}).`);
  else if (live !== expected) problems.push("The live Life at Shaare Tefila section doesn't match what was just published.");
  for (const src of new Set([...expected.matchAll(/src="([^"]+)"/g)].map((m) => m[1]))) {
    const img = await fetch(base + src, { method: "HEAD", cache: "no-store" });
    if (!img.ok) problems.push(`The photo ${src} doesn't load (${img.status}).`);
  }
  return problems;
}

let problems = [];
for (let attempt = 1; attempt <= 6; attempt++) {
  problems = await check();
  if (problems.length === 0) { console.log(`Live site OK: ${base}`); process.exit(0); }
  console.log(`Attempt ${attempt}: ${problems.join(" ")}`);
  await sleep(20_000);
}
await notifyFailure(
  "the live site check failed after publishing",
  [`The website was published, but the live site at ${base} doesn't look right:`, "", ...problems.map((p) => `- ${p}`), "",
   "To put the previous version back, see 'Restore an earlier version' in SETUP.md."].join("\n"),
);
process.exit(1);
