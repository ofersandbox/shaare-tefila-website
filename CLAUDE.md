# Shaare Tefila website: notes for Claude

A friendlier rebuild of https://www.shaaretefila.org/ (Conservative synagogue, Olney, MD).
Owner: Ofer. This is the **sandbox/prototype** run under ofer.sandbox@gmail.com; it will
later move to the congregation's own Google and GitHub accounts (see SETUP.md).
The office maintains content; section owners are **not technical**.

Live site: https://ofersandbox.github.io/shaare-tefila-website/
Repo: https://github.com/ofersandbox/shaare-tefila-website (public, branch `main`)
Plan doc (logins, members area, per-section ownership):
https://claude.ai/artifact/TvCUGBa1WPtYEZV2SToBzX

## How the site works

- Static site, no framework. `index.html` has the header/nav/footer and `data-include`
  placeholders; `js/main.js` fetches each section's HTML (with `cache:'no-cache'`, so
  updates show on a normal reload) and routes by hash (`#home`, `#about`, `#worship`,
  `#learn`, `#involved`, `#news`, `#give`, `#visit`, `#gallery`, `#calendar`).
  Any element id works as a hash target (e.g. `#album-march-2020`).
- Needs a web server to preview (fetch doesn't work from file://):
  `npm run serve` → http://localhost:8000
- `css/style.css` holds all styles. `common/` holds assets used on more than one page;
  everything else lives in `sections/<page>/` next to its HTML.

## Content from Google Drive (the important part)

Drive is the source of truth for sections that have been converted. People edit Drive,
never these files. Drive layout (sandbox): top folder **"ST Sandbox"** containing
**"Life at Shaare Tefila"** and **"Gallery"**. It's shared with the robot account as Viewer.

- **Life at Shaare Tefila** (home page photo mosaic): `build/sync-life-at.mjs`.
  Photos named `N - Caption.jpg`, 3–8 shown, strict checks; on any problem it **holds**
  the update (keeps the last good version) and notifies. Template:
  `sections/home/04-life-at-shaare-tefila.njk` → generated `.html` + `sections/home/life-at/`.
- **Gallery**: `build/sync-gallery.mjs`. Each sub-folder of Gallery is an album
  (`2025-12 Hanukkah`, `2021`, or undated); newest first; loose photos go last as
  "More photos". Any file name; caption = file name unless it's a camera name; order =
  leading number, else EXIF date, else name. HEIC converted (heic-convert). Bad photos
  are **skipped and reported**, never hold the gallery. Writes
  `sections/gallery/albums.json` (committed). Resized images go to
  `sections/gallery/built/` (**gitignored**; kept in a GitHub Actions cache).
  Page: album list on the left (chips on phones), show/hide per album, newest albums
  open up to ~40 photos, closed albums load nothing until opened.
- Shared code: `build/lib/drive.mjs` (list/download; `sectionFolder(name, explicitId)`
  finds a section by folder name inside `WEBSITE_FOLDER_ID`), `build/lib/notify.mjs`
  (run summary + optional email, same notice at most once a day via `build/state/`).
- Local test without Google: `npm run sync:local` reads `../drive-starter/` (a stand-in
  for the top Drive folder).

## Publishing (GitHub Actions: `.github/workflows/publish.yml`)

Runs hourly (:17), on push to main, and on "Run workflow" (optional `restore_version`).
Steps: sign in to Google via **Workload Identity Federation** (no key) → Check 1
(Life-at sync, then Gallery sync with cache restore/save) → commit generated files back
("Update from Google Drive") → publish only if something changed or not a scheduled run →
**Check 2** Playwright tests (laptop + phone) → deploy to Pages → **Check 3**
`tests/live-check.mjs` → on failure, email the office.

GitHub repo **variables**: `GCP_WORKLOAD_IDENTITY_PROVIDER`
(projects/883683390295/locations/global/workloadIdentityPools/github/providers/shaare-tefila-site),
`GCP_SERVICE_ACCOUNT` (st-website-builder@shaare-tefila-project.iam.gserviceaccount.com),
`WEBSITE_FOLDER_ID` (the "ST Sandbox" folder), `LIFE_AT_FOLDER_ID`, `NOTIFY_TO`;
optional `GALLERY_FOLDER_ID`, `*_OWNER_EMAIL`. Email secrets `SMTP_*` not set up yet.

The robot commits to `main` every time Drive changes: **always pull before editing**.

## Tests

`npm test` (Playwright; starts its own server on port 8123). Run it after any change to
pages, CSS or JS. Add a test when adding behaviour.
Locally (no `CI` env var) without `sections/gallery/built/`, the gallery photo-file checks
are skipped (3 skips are normal); on GitHub (`CI=true`) they are always enforced.
Node is installed in `~/.local/node` (PATH set in `~/.zprofile`).

## Lessons learned (don't repeat)

- WIF issuer must be exactly `https://token.actions.githubusercontent.com` (no trailing slash).
- The `Workload Identity User` grant goes on the service account to
  `principalSet://…/attribute.repository/ofersandbox/shaare-tefila-website`.
- Git add of a path that doesn't exist exits 128: keep `build/state/` in the repo.
- `.gal{display:grid}` overrides the `hidden` attribute: hence `.gal[hidden]{display:none}`.
- Files uploaded on github.com land in the folder you're viewing; workflows must be in
  `.github/workflows/`. There is a stray, ignored `.github/publish.yml` that can be deleted.
- Owners are non-technical: messages they see must say what to do in Drive, in plain words.

## Ideas not done yet

Convert the remaining (mostly text) sections to Drive, probably one Google Doc per
section; set up email notices (SETUP.md Part 5); members-only features per the plan doc.
