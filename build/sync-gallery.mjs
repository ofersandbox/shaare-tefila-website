// Photo gallery: Google Drive "Gallery" folder -> website gallery page.
//
// In Drive, the Gallery folder (inside the Website folder) holds one sub-folder
// per album, for example "2025-12 Hanukkah". The page shows the albums as
// headings down one page, newest first. Photos directly in the Gallery folder
// (not in an album) are shown last, under "More photos".
//
// Unlike the home-page sections, one bad photo never holds back the gallery:
// it is skipped, and the office is told which photo and why.
//
// Writes:
//   sections/gallery/albums.json    the list of albums and photos (saved in GitHub)
//   sections/gallery/built/*.jpg    resized photos (NOT saved in GitHub; rebuilt
//                                   from Drive and kept between runs in a cache)
//
// To test on a computer:  npm run sync:local   (reads ../drive-starter)

import sharp from "sharp";
import exifr from "exifr";
import heicConvert from "heic-convert";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, appendFile, access } from "node:fs/promises";
import { listFolder, downloadFile, folderLink, sectionFolder, FOLDER } from "./lib/drive.mjs";
import { notifySection, summary } from "./lib/notify.mjs";

const SECTION = "Gallery";
const SLUG = "gallery";
const EXPLICIT_FOLDER_ID = process.env.GALLERY_FOLDER_ID; // optional; otherwise found by name
const OWNER_EMAIL = process.env.GALLERY_OWNER_EMAIL;

const ROOT = new URL("../", import.meta.url);
const DATA_FILE = new URL("sections/gallery/albums.json", ROOT);
const BUILT_DIR = new URL("sections/gallery/built/", ROOT);
const INDEX_FILE = new URL("index.json", BUILT_DIR);
const WEB_PATH = "sections/gallery/built/"; // as seen from index.html

const THUMB = 640;            // grid tiles
const LARGE = 1600;           // the "view larger" picture
const MIN_LONG_SIDE = 400;    // smaller photos look blurry even as a small tile
const MAX_FILE_MB = 60;
const MAX_NEW_PER_RUN = Number(process.env.GALLERY_MAX_NEW || 300); // the rest wait for the next run
const MAX_CAPTION = 80;
const LOOSE_ALBUM = "More photos";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif", "image/tiff"];
const AUTO_NAME = /^(img|dsc|dscn|dscf|pxl|mvimg|photo|image|picture|pic|screenshot|screen shot|whatsapp image|signal|fullsizerender|edited)?[\s_-]*[\d_ .()-]*(edited)?$/i;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
const exists = (u) => access(u).then(() => true, () => false);
const readJson = async (u, fallback) => { try { return JSON.parse(await readFile(u, "utf8")); } catch { return fallback; } };

// "2025-12 Hanukkah" -> { sortDate: "2025-12", title: "Hanukkah", when: "December 2025" }
// "2021" -> { sortDate: "2021", title: "2021" }; "Purim" -> { sortDate: null, title: "Purim" }
export function parseAlbum(name) {
  const m = name.trim().match(/^((?:19|20)\d\d)(?:[-_. ](\d{1,2}))?(?:[-_. ](\d{1,2}))?(?=\s|$|[-–—_:,])\s*[-–—_:,]?\s*(.*)$/);
  if (!m || Number(m[2] || 1) > 12) return { sortDate: null, title: name.trim(), when: "" };
  const [, y, mo, d, rest] = m;
  const sortDate = [y, mo && mo.padStart(2, "0"), mo && d && d.padStart(2, "0")].filter(Boolean).join("-");
  const when = mo ? `${MONTHS[Number(mo) - 1]} ${y}` : y;
  const title = rest.trim() || when;
  // Don't repeat the date under a title that already says it ("September–October 2018").
  return { sortDate, title, when: title.includes(y) ? "" : when };
}

// "3 - Kids at the seder (2).jpg" -> { order: 3, caption: "Kids at the seder" }
// "IMG_1234.HEIC" -> { order: null, caption: "" }
export function parsePhotoName(name) {
  let base = name.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  let order = null;
  const num = base.match(/^(\d{1,3})(?:\s*[-–—.)_]\s*(.*))?$/);
  if (num) { order = Number(num[1]); base = num[2] || ""; }
  base = base.replace(/\s*\(\d+\)$/, "").replace(/[\s_-]+\d{1,3}$/, "").replace(/_/g, " ").trim();
  if (!base || AUTO_NAME.test(base) || /^\d[\d\s_.-]*$/.test(base)) base = "";
  return { order, caption: base.slice(0, MAX_CAPTION) };
}

function keyFor(file) {
  return createHash("sha1").update(`${file.id}\n${file.version}`).digest("hex").slice(0, 12);
}

async function toJpegReadyBuffer(buffer, mimeType) {
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return Buffer.from(await heicConvert({ buffer, format: "JPEG", quality: 0.92 }));
  }
  return buffer;
}

async function takenTime(buffer) {
  try {
    const t = await exifr.parse(buffer, ["DateTimeOriginal", "CreateDate"]);
    const d = t && (t.DateTimeOriginal || t.CreateDate);
    return d instanceof Date && !isNaN(d) ? d.toISOString() : null;
  } catch { return null; }
}

async function main() {
  let folderId = EXPLICIT_FOLDER_ID;
  let folderUrl = folderLink(folderId);
  let top;
  try {
    folderId = await sectionFolder(SECTION, EXPLICIT_FOLDER_ID);
    if (!folderId) throw new Error(`there is no folder named "${SECTION}" in the Website folder`);
    folderUrl = folderLink(folderId);
    top = await listFolder(folderId);
  } catch (err) {
    await notifySection({
      slug: SLUG, section: "Photo gallery", folderUrl, ownerEmail: null,
      problems: [`The website could not read the Gallery folder in Google Drive (${err.message}). The gallery page keeps its current photos. This is a setup problem, not something a photographer did.`],
    });
    await setOutput("gallery_changed", "false");
    return;
  }

  const reminders = [];
  const albumsIn = [];
  const loose = top.filter((f) => f.mimeType !== FOLDER);
  for (const f of top.filter((f) => f.mimeType === FOLDER)) {
    const items = (await listFolder(f.id)).filter((x) => {
      if (x.mimeType === FOLDER) { reminders.push(`The folder "${f.name}/${x.name}" is inside an album. Albums can't contain other folders, so its photos aren't shown. Move them up into "${f.name}" or make "${x.name}" its own album.`); return false; }
      return true;
    });
    albumsIn.push({ folder: f, ...parseAlbum(f.name), items });
  }
  if (loose.length) albumsIn.push({ folder: null, sortDate: null, title: LOOSE_ALBUM, when: "", items: loose, loose: true });

  // Resized photos made by earlier runs (kept in the cache between runs).
  await mkdir(BUILT_DIR, { recursive: true });
  const index = await readJson(INDEX_FILE, {});
  const used = new Set(["index.json"]);
  let processedNew = 0, waiting = 0;

  const albums = [];
  for (const a of albumsIn) {
    const where = a.loose ? "the Gallery folder" : `the "${a.folder.name}" album`;
    const photos = [];
    for (const f of a.items) {
      if (!f.mimeType.startsWith("image/")) {
        if (f.mimeType.startsWith("video/")) reminders.push(`"${f.name}" in ${where} is a video. The gallery only shows photos.`);
        else reminders.push(`"${f.name}" in ${where} isn't a photo, so it isn't shown.`);
        continue;
      }
      if (!IMAGE_TYPES.includes(f.mimeType)) { reminders.push(`"${f.name}" in ${where} is a kind of image the website can't use. Please upload it as a JPEG.`); continue; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { reminders.push(`"${f.name}" in ${where} is very large (${Math.round(f.size / 1048576)} MB) and was skipped. Please upload a smaller copy (under ${MAX_FILE_MB} MB).`); continue; }

      const key = keyFor(f);
      used.add(key);
      const thumbName = `${key}-${THUMB}.jpg`, largeName = `${key}-${LARGE}.jpg`;
      let info = index[key];
      const ready = info && !info.error && await exists(new URL(thumbName, BUILT_DIR)) && await exists(new URL(largeName, BUILT_DIR));

      if (info && info.error) { // a photo that failed before; don't download it every hour
        reminders.push(info.error.replace("{where}", where));
        continue;
      }
      if (!ready) {
        if (processedNew >= MAX_NEW_PER_RUN) { waiting++; used.delete(key); continue; }
        processedNew++;
        try {
          const original = await downloadFile(f.id);
          const buffer = await toJpegReadyBuffer(original, f.mimeType);
          const meta = await sharp(buffer).rotate().metadata();
          const turned = (meta.orientation || 1) >= 5; // camera held sideways
          const w = turned ? meta.height : meta.width, h = turned ? meta.width : meta.height;
          if (Math.max(w, h) < MIN_LONG_SIDE) {
            index[key] = { error: `"${f.name}" in {where} is too small (${w} x ${h} pixels) and would look blurry, so it was skipped. Please use a photo at least ${MIN_LONG_SIDE} pixels on its longer side.` };
            reminders.push(index[key].error.replace("{where}", where));
            continue;
          }
          const sizes = {};
          for (const [size, name] of [[THUMB, thumbName], [LARGE, largeName]]) {
            // .rotate() applies the camera's orientation; sharp drops all other
            // metadata (including GPS location) unless asked to keep it.
            sizes[size] = await sharp(buffer).rotate()
              .resize(size, size, { fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 80, mozjpeg: true })
              .toFile(new URL(name, BUILT_DIR).pathname);
          }
          info = index[key] = { width: sizes[LARGE].width, height: sizes[LARGE].height, taken: (await takenTime(original)) || null };
        } catch (err) {
          console.error(`Could not use ${f.name}:`, err.message);
          index[key] = { error: `"${f.name}" in {where} couldn't be opened as a photo, so it was skipped. Please upload it again as a JPEG.` };
          reminders.push(index[key].error.replace("{where}", where));
          continue;
        }
      }
      const { order, caption } = parsePhotoName(f.name);
      photos.push({
        key, order, caption, name: f.name,
        taken: info.taken, created: f.created,
        thumb: WEB_PATH + thumbName, src: WEB_PATH + largeName,
        width: info.width, height: info.height,
      });
    }
    if (!photos.length) continue;
    // Numbered photos first (in number order), then by the date taken, then by name.
    photos.sort((p, q) =>
      (p.order ?? Infinity) - (q.order ?? Infinity) ||
      (p.taken || "￿").localeCompare(q.taken || "￿") ||
      p.name.localeCompare(q.name, undefined, { numeric: true }));
    const newest = photos.map((p) => p.taken || p.created || "").sort().at(-1) || a.folder?.created || "";
    albums.push({ ...a, photos, newest });
  }

  // Albums: dated ones by their date, undated ones by their newest photo; newest first.
  // "More photos" (not in any album) always goes last.
  albums.sort((a, b) => ((a.loose ? 1 : 0) - (b.loose ? 1 : 0)) || (b.sortDate || b.newest.slice(0, 10)).localeCompare(a.sortDate || a.newest.slice(0, 10)) || a.title.localeCompare(b.title));

  if (waiting) reminders.push(`${waiting} new photo${waiting === 1 ? " is" : "s are"} still being prepared and will appear within the next few hours.`);

  // Clean out resized photos that are no longer in Drive.
  for (const name of await readdir(BUILT_DIR)) {
    const key = name.split("-")[0].replace(".json", "");
    if (!used.has(name) && !used.has(key)) await rm(new URL(name, BUILT_DIR));
  }
  for (const k of Object.keys(index)) if (!used.has(k)) delete index[k];
  await writeFile(INDEX_FILE, JSON.stringify(index) + "\n");

  const out = albums.map((a) => ({
    title: a.title,
    when: a.when,
    photos: a.photos.map(({ caption, thumb, src, width, height }) => ({ caption, thumb, src, width, height })),
  }));
  const fingerprint = createHash("sha1").update(JSON.stringify(out)).digest("hex").slice(0, 16);
  const previous = await readJson(DATA_FILE, null);

  await notifySection({ slug: SLUG, section: "Photo gallery", folderUrl, problems: [], reminders, ownerEmail: OWNER_EMAIL });

  const total = out.reduce((n, a) => n + a.photos.length, 0);
  if (previous && previous.fingerprint === fingerprint) {
    console.log(`Gallery: no changes (${out.length} albums, ${total} photos).${processedNew ? ` Re-made ${processedNew} resized photos.` : ""}`);
    await setOutput("gallery_changed", "false");
    await setOutput("gallery_rebuilt", processedNew ? "true" : "false");
    return;
  }
  await writeFile(DATA_FILE, JSON.stringify({ section: "Photo gallery", updated: new Date().toISOString(), fingerprint, albums: out }, null, 1) + "\n");
  await summary(`### Updated: Photo gallery\n\n${out.length} albums, ${total} photos: ${out.map((a) => `${a.title} (${a.photos.length})`).join(", ")}`);
  await setOutput("gallery_changed", "true");
  await setOutput("gallery_rebuilt", "true");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (err) => {
    console.error(err);
    await setOutput("gallery_changed", "false");
    process.exitCode = 1;
  });
}
