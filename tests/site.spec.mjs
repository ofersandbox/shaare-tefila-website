// CHECK 2: the whole site, tested in a browser at laptop and phone sizes.
// If any test fails, the site is NOT published and the office is told.
import { test, expect } from "@playwright/test";

const PAGES = ["home", "about", "worship", "learn", "involved", "news", "give", "visit", "gallery", "calendar"];

async function openSite(page, hash = "home") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./#${hash}`);
  // Wait until every section file has been loaded into the page.
  await expect(page.locator("[data-include]")).toHaveCount(0, { timeout: 15_000 });
  return errors;
}

test("every page opens without errors or missing sections", async ({ page }) => {
  const errors = await openSite(page);
  await expect(page.getByText("couldn't load")).toHaveCount(0);
  for (const id of PAGES) {
    await page.evaluate((h) => { location.hash = h; }, id);
    await expect(page.locator(`#${id}.view.on`)).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width, `page "${id}" scrolls sideways`).toBeLessThanOrEqual(1);
  }
  expect(errors, "script errors on the page").toEqual([]);
});

test("home page shows the essentials", async ({ page }) => {
  await openSite(page);
  await expect(page.locator("#home h1")).toHaveText("Shaare Tefila Congregation");
  await expect(page.getByText("Join us for services")).toBeVisible();
  await expect(page.locator("footer")).toContainText("(301) 593-3410");
  await expect(page.locator("footer")).toContainText("16620 Georgia Avenue");
  await expect(page.locator("a[href='#give']").first()).toBeAttached();
});

test("Life at Shaare Tefila: 3 to 8 photos, all loaded, no gaps", async ({ page }) => {
  await openSite(page);
  const grid = page.locator(".mosaic");
  await grid.scrollIntoViewIfNeeded();
  const figures = grid.locator("figure");
  const count = await figures.count();
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(8);
  await expect(grid).toHaveClass(new RegExp(`mosaic--${count}(\\s|$)`));

  for (let i = 0; i < count; i++) {
    const img = figures.nth(i).locator("img");
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth), { message: `photo ${i + 1} did not load` }).toBeGreaterThan(0);
    await expect(figures.nth(i).locator("figcaption")).not.toBeEmpty();
    await expect(img).toHaveAttribute("alt", /\S/);
  }

  // No gaps: the photos (plus the spacing between them) cover the whole grid.
  const coverage = await grid.evaluate((el) => {
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
    const g = el.getBoundingClientRect();
    let area = 0;
    for (const f of el.children) { const r = f.getBoundingClientRect(); area += (r.width + gap) * (r.height + gap); }
    return area / ((g.width + gap) * (g.height + gap));
  });
  expect(coverage, "the photo grid has an empty gap").toBeGreaterThan(0.98);
  expect(coverage, "photos overlap in the grid").toBeLessThan(1.02);
});

test("every link and image within the site works", async ({ page, request }) => {
  test.skip(test.info().project.name !== "laptop", "checked once, at laptop size");
  await openSite(page);
  const urls = await page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href");
      if (h && !h.startsWith("#") && !/^(https?:|mailto:|tel:)/.test(h)) out.add(h);
    }
    for (const img of document.querySelectorAll("img[src]")) out.add(img.getAttribute("src"));
    for (const img of document.querySelectorAll("img[srcset]")) {
      for (const part of img.getAttribute("srcset").split(",")) out.add(part.trim().split(/\s+/)[0]);
    }
    return [...out];
  });
  const broken = [];
  for (const u of urls) {
    const res = await request.head(u);
    if (!res.ok()) broken.push(`${u} (${res.status()})`);
  }
  expect(broken, "broken links or images").toEqual([]);
});

test("Photo gallery: albums as headings, photos load, 'Show more' works", async ({ page, request }) => {
  const data = await (await request.get("sections/gallery/albums.json")).json();
  const total = data.albums.reduce((n, a) => n + a.photos.length, 0);
  await openSite(page, "gallery");
  if (total === 0) {
    await expect(page.locator("#galCount")).toContainText("on their way");
    return;
  }
  // The first album's heading and its first photos.
  const first = page.locator("#galAlbums .album").first();
  await expect(first.locator("h2")).toHaveText(data.albums[0].title);
  const img = first.locator("img").first();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth), { message: "first gallery photo did not load" }).toBeGreaterThan(0);
  await expect(page.locator("#galCount")).toHaveText(`Showing ${Math.min(40, total)} of ${total} photos`);

  if (total > 40) {
    await page.locator("#galMore").click();
    await expect(page.locator("#galAlbums button")).toHaveCount(Math.min(80, total));
  }
  // Every album heading appears once, in order, after showing everything.
  while (await page.locator("#galMore").isVisible()) await page.locator("#galMore").click();
  await expect(page.locator("#galAlbums .album h2")).toHaveText(data.albums.map((a) => a.title));

  // The big view opens, shows the large photo, and moves to the next one.
  await page.locator("#galAlbums button").first().click();
  await expect(page.locator("#lb")).toHaveClass(/on/);
  await expect(page.locator("#lbImg")).toHaveAttribute("src", data.albums[0].photos[0].src);
  await page.locator("#lbNext").click();
  const second = data.albums[0].photos[1] || data.albums[1].photos[0];
  await expect(page.locator("#lbImg")).toHaveAttribute("src", second.src);
});

test("every gallery photo file exists", async ({ request }) => {
  test.skip(test.info().project.name !== "laptop", "checked once, at laptop size");
  const data = await (await request.get("sections/gallery/albums.json")).json();
  const missing = [];
  for (const a of data.albums) for (const p of a.photos) for (const u of [p.thumb, p.src]) {
    const res = await request.head(u);
    if (!res.ok()) missing.push(`${a.title}: ${u}`);
  }
  expect(missing, "gallery photos missing from the site").toEqual([]);
});
