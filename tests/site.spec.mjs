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

test("Photo gallery: album list, show/hide buttons, photos load", async ({ page, request }) => {
  const data = await (await request.get("sections/gallery/albums.json")).json();
  await openSite(page, "gallery");
  if (data.albums.length === 0) {
    await expect(page.locator("#galAlbums")).toContainText("on their way");
    return;
  }
  // The list on the left has every album, in order, and so does the page.
  const titles = data.albums.map((a) => a.title);
  await expect(page.locator("#galNav li span")).toHaveText(titles);
  await expect(page.locator("#galAlbums .album h2")).toHaveText(titles);

  // The newest album starts open and its photos load.
  const first = page.locator("#galAlbums .album").first();
  await expect(first.locator(".album-toggle")).toHaveAttribute("aria-expanded", "true");
  const img = first.locator(".gal img").first();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth), { message: "first gallery photo did not load" }).toBeGreaterThan(0);

  // Its button hides the photos and shows them again.
  await first.locator(".album-toggle").click();
  await expect(first.locator(".gal")).toBeHidden();
  await first.locator(".album-toggle").click();
  await expect(first.locator(".gal")).toBeVisible();

  // Clicking the last album in the list opens it and brings it into view.
  const last = page.locator("#galAlbums .album").last();
  await page.locator("#galNav a").last().click();
  await expect(last.locator(".gal")).toBeVisible();
  await expect(last.locator(".gal button")).toHaveCount(data.albums.at(-1).photos.length);
  await expect(last.locator("h2")).toBeInViewport();

  // "Hide all" and "Show all".
  await page.locator("#galNav [data-all=hide]").click();
  await expect(page.locator("#galAlbums .gal:visible")).toHaveCount(0);
  await page.locator("#galNav [data-all=show]").click();
  await expect(page.locator("#galAlbums .gal:visible")).toHaveCount(data.albums.length);

  // The big view opens, shows the large photo, and moves to the next one.
  await first.locator(".gal button").first().click();
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
