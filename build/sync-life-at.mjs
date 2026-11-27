// Life at Shaare Tefila: Google Drive folder -> website section.
//
// 1. Reads the photos in the section's Drive folder.
// 2. CHECK 1: makes sure the folder is usable (names, captions, count, size).
//    If not, nothing on the website changes (the last good version stays)
//    and the owner and the office are told what to fix.
// 3. Resizes the photos, removes hidden location data, and writes:
//      sections/home/life-at/*.jpg         the photos
//      sections/home/life-at/photos.json   the list, also used as a record
//      sections/home/04-life-at-shaare-tefila.html   the finished section
//
// Run in GitHub by .github/workflows/publish.yml. To test on a computer:
//   npm run sync:local   (reads test-drive/life-at instead of Google Drive)

import sharp from "sharp";
import nunjucks from "nunjucks";
import { mkdir, readFile, readdir, rm, writeFile, appendFile } from "node:fs/promises";
import { listFolder, downloadFile, folderLink } from "./lib/drive.mjs";
import { notifySection, summary } from "./lib/notify.mjs";

const SECTION = "Life at Shaare Tefila";
const SLUG = "life-at";
const FOLDER_ID = process.env.LIFE_AT_FOLDER_ID;
const OWNER_EMAIL = process.env.LIFE_AT_OWNER_EMAIL;

const ROOT = new URL("../", import.meta.url);
const OUT_DIR = new URL("sections/home/life-at/", ROOT);
const DATA_FILE = new URL("photos.json", OUT_DIR);
const TEMPLATE = "sections/home/04-life-at-shaare-tefila.njk";
const HTML_FILE = new URL("sections/home/04-life-at-shaare-tefila.html", ROOT);
const WEB_PATH = "sections/home/life-at/"; // as seen from index.html

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const MIN_LONG_SIDE = 800; // pixels; smaller photos look blurry in the big spot
const MAX_CAPTION = 60;    // characters
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AUTO_NAME = /^(img|dsc|dscn|pxl|photo|image|screenshot|whatsapp image)[\s_-]*[\d_ .-]*$/i;

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

// "3 - Purim carnival.jpg" -> { order: 3, caption: "Purim carnival" }
function parseName(name) {
  const m = name.match(/^\s*(\d{1,3})\s*[-–—.)_]\s*(.+?)\s*\.[a-z0-9]+$/i);
  return m ? { order: Number(m[1]), caption: m[2] } : null;
}

function slugify(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 40) || "photo";
}

function render(data, folderUrl) {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(ROOT.pathname), { autoescape: true, throwOnUndefined: true });
  return env.render(TEMPLATE, { lifeAt: data, folderUrl });
}

async function readPrevious() {
  try { return JSON.parse(await readFile(DATA_FILE, "utf8")); } catch { return null; }
}

async function main() {
  const folderUrl = folderLink(FOLDER_ID);
  let files;
  try {
    files = await listFolder(FOLDER_ID);
  } catch (err) {
    // Can't reach Drive: keep the website as it is and tell the office.
    await notifySection({
      slug: SLUG, section: SECTION, folderUrl, ownerEmail: null,
      problems: [`The website could not read the Google Drive folder (${err.message}). This is a setup problem, not something the section owner did.`],
    });
    await setOutput("changed", "false");
    await setOutput("status", "error");
    return;
  }

  const problems = [];
  const reminders = [];
  const candidates = [];

  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") continue;
    if (f.mimeType === "image/heic" || f.mimeType === "image/heif") {
      problems.push(`"${f.name}" is an iPhone HEIC photo, which websites can't show. Please upload it as a JPEG instead (on iPhone: Settings > Camera > Formats > Most Compatible, or share it as JPEG).`);
      continue;
    }
    if (!f.mimeType.startsWith("image/")) {
      reminders.push(`"${f.name}" isn't a photo, so it isn't used. This section only shows photos.`);
      continue;
    }
    if (!OK_TYPES.includes(f.mimeType)) {
      problems.push(`"${f.name}" is a type of image the website can't use. Please upload it as a JPEG or PNG.`);
      continue;
    }
    const parsed = parseName(f.name);
    if (!parsed) {
      problems.push(`Please rename "${f.name}" so it starts with a number and describes the photo, for example "3 - Purim carnival.jpg".`);
      continue;
    }
    if (AUTO_NAME.test(parsed.caption)) {
      problems.push(`"${f.name}" needs a real caption. Rename it to describe the photo, for example "${parsed.order} - Purim carnival.jpg".`);
      continue;
    }
    if (parsed.caption.length > MAX_CAPTION) {
      problems.push(`The caption in "${f.name}" is ${parsed.caption.length} characters long. Please shorten it to ${MAX_CAPTION} or fewer.`);
      continue;
    }
    candidates.push({ ...parsed, file: f });
  }

  candidates.sort((a, b) => a.order - b.order || a.caption.localeCompare(b.caption));
  const seen = new Map();
  for (const c of candidates) {
    if (seen.has(c.order)) reminders.push(`Two photos start with the number ${c.order} ("${seen.get(c.order)}" and "${c.file.name}"). They're shown in alphabetical order; give each its own number to choose the order.`);
    else seen.set(c.order, c.file.name);
  }

  if (candidates.length < MIN_PHOTOS) {
    problems.push(`The section needs at least ${MIN_PHOTOS} photos to fill its space; the folder has ${candidates.length}.`);
  }
  if (candidates.length > MAX_PHOTOS) {
    reminders.push(`The folder has ${candidates.length} photos. Only the first ${MAX_PHOTOS} (by number) appear on the home page, with a link to the photo gallery.`);
  }

  const shown = candidates.slice(0, MAX_PHOTOS);
  const fingerprint = shown.map((c) => `${c.file.id}:${c.file.version}:${c.order}:${c.caption}`).join("|") + `|more:${candidates.length > MAX_PHOTOS}`;
  const previous = await readPrevious();

  // Download and check each photo's size before changing anything.
  const images = [];
  if (problems.length === 0) {
    for (const c of shown) {
      const buffer = await downloadFile(c.file.id);
      let meta;
      try { meta = await sharp(buffer).rotate().metadata(); }
      catch { problems.push(`"${c.file.name}" couldn't be opened as a photo. Please upload it again as a JPEG.`); continue; }
      const longSide = Math.max(meta.width, meta.height);
      if (longSide < MIN_LONG_SIDE) {
        problems.push(`"${c.file.name}" is too small (${meta.width} x ${meta.height} pixels) and would look blurry. Please use a photo at least ${MIN_LONG_SIDE} pixels on its longer side.`);
        continue;
      }
      images.push({ ...c, buffer });
    }
  }

  await notifySection({ slug: SLUG, section: SECTION, folderUrl, problems, reminders, ownerEmail: OWNER_EMAIL });

  if (problems.length > 0) {
    await setOutput("changed", "false");
    await setOutput("status", "held");
    return;
  }
  if (previous && previous.fingerprint === fingerprint) {
    // Same photos. Re-render anyway in case the layout template changed.
    const html = render(previous, folderUrl);
    let current = "";
    try { current = await readFile(HTML_FILE, "utf8"); } catch {}
    if (html !== current) {
      await writeFile(HTML_FILE, html);
      await summary(`### Updated: ${SECTION}\n\nSame photos, new layout template.`);
      await setOutput("changed", "true");
      await setOutput("status", "updated");
      return;
    }
    console.log(`${SECTION}: no changes in the Drive folder.`);
    await setOutput("changed", "false");
    await setOutput("status", "unchanged");
    return;
  }

  // Everything checked out: write the new photos and the finished section.
  await mkdir(OUT_DIR, { recursive: true });
  for (const old of await readdir(OUT_DIR)) {
    if (old.endsWith(".jpg")) await rm(new URL(old, OUT_DIR));
  }
  const photos = [];
  for (const img of images) {
    const base = `${String(img.order).padStart(2, "0")}-${slugify(img.caption)}`;
    const sizes = [];
    for (const width of [600, 1200]) {
      const name = `${base}-${width}.jpg`;
      // .rotate() applies the camera's orientation; sharp drops all other
      // metadata (including GPS location) unless asked to keep it.
      const info = await sharp(img.buffer).rotate()
        .resize(width, width, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toFile(new URL(name, OUT_DIR).pathname);
      sizes.push({ url: WEB_PATH + name, width: info.width, height: info.height });
    }
    const large = sizes.at(-1);
    photos.push({
      order: img.order,
      caption: img.caption,
      src: large.url,
      srcset: sizes.map((s) => `${s.url} ${s.width}w`).join(", "),
      width: large.width,
      height: large.height,
    });
  }

  const data = { section: SECTION, updated: new Date().toISOString(), fingerprint, moreInFolder: candidates.length > MAX_PHOTOS, photos };
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  await writeFile(HTML_FILE, render(data, folderUrl));

  await summary(`### Updated: ${SECTION}\n\n${photos.length} photos: ${photos.map((p) => p.caption).join(", ")}`);
  await setOutput("changed", "true");
  await setOutput("status", "updated");
}

main().catch(async (err) => {
  console.error(err);
  await setOutput("changed", "false");
  await setOutput("status", "error");
  process.exitCode = 1;
});
