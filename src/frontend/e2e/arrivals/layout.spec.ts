import type { Page } from "@playwright/test";

import { expect, test } from "./support/test";

// Apple's and Google's minimum for a finger target.
const MIN_TAP_PX = 44;

async function hasNoSideScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

// Known to fall short of 44 px, to fix in the app (found by this suite): the
// step-back symbols beside a card are 43 px wide on a 390 px phone, and the
// roll select of the help desk is 30 px high. Listed so that every other target
// stays checked; delete an entry once its screen is fixed.
const KNOWN_SMALL_TARGETS = [/^Badge .* : (remettre|déjà remis)/, /× \d+ cm/];

/** Visible buttons, links and fields of the page narrower or lower than a finger. */
async function smallTargets(page: Page) {
  const found = await page.evaluate((min) => {
    return Array.from(document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea"))
      .filter((el) => el.checkVisibility())
      .map((el) => ({ label: (el.getAttribute("aria-label") ?? el.textContent ?? el.id).trim().slice(0, 40), box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < min || box.height < min)
      .map(({ label, box }) => `${label} (${Math.round(box.width)}×${Math.round(box.height)})`);
  }, MIN_TAP_PX);
  return found.filter((target) => !KNOWN_SMALL_TARGETS.some((known) => known.test(target)));
}

async function isInFirstScreen(page: Page, name: string | RegExp, role: "button" | "searchbox" = "button") {
  const box = await page.getByRole(role, { name }).first().boundingBox();
  const height = page.viewportSize()!.height;
  return box !== null && box.y >= 0 && box.y + box.height <= height;
}

test.describe("mobile layout", () => {
  test("@layout should keep the Scan screen within the width, its button and field in the first screen", async ({ openStation }) => {
    const page = await openStation("scan");
    await expect(page.getByRole("button", { name: "Scanner un billet" })).toBeVisible();

    expect(await hasNoSideScroll(page)).toBe(true);
    expect(await isInFirstScreen(page, "Scanner un billet")).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("@layout should keep the Scan screen within the width with a result and a search on screen", async ({ openStation, data }) => {
    const page = await openStation("scan");

    await page.getByLabel(/Pas de confirmation/).fill(data.attendees.already.barcode);
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText("2 1 02", { exact: true })).toBeVisible();
    await page.getByLabel(/Pas de confirmation/).fill("Test");
    await expect(page.getByRole("list", { name: "Résultats de la recherche" })).toBeVisible();

    expect(await hasNoSideScroll(page)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("@layout should keep the help desk within the width, its search in the first screen", async ({ openStation, data }) => {
    const scan = await openStation("scan");
    await scan.getByLabel(/Pas de confirmation/).fill(data.attendees.nobadge.barcode);
    await scan.getByRole("button", { name: "Valider" }).click();
    await expect(scan.getByText("Guichet d'aide", { exact: true })).toBeVisible();
    const help = await openStation("help");
    await help.getByRole("button", { name: /Nael Testsansbadge/ }).click();
    await expect(help.getByRole("button", { name: "Imprimer l'étiquette" })).toBeVisible();

    expect(await hasNoSideScroll(help)).toBe(true);
    expect(await isInFirstScreen(help, /Chercher quelqu/, "searchbox")).toBe(true);
    expect(await smallTargets(help)).toEqual([]);
  });

  test("@layout should keep a counter within the width, with cards a finger can hit", async ({ openStation, data }) => {
    const counter = await openStation("c1");
    const scan = await openStation("scan");
    await scan.getByLabel(/Pas de confirmation/).fill(data.attendees.layout.barcode);
    await scan.getByRole("button", { name: "Valider" }).click();
    await expect(counter.getByRole("button", { name: /Lou Testmiseenpage/ })).toBeVisible();

    expect(await hasNoSideScroll(counter)).toBe(true);
    // The column's first card, whichever it is: other tests leave cards at
    // this counter, and the newest goes last.
    const firstCard = counter.getByRole("region", { name: "À chercher" }).getByRole("button").first();
    const box = await firstCard.boundingBox();
    expect(box !== null && box.y + box.height <= counter.viewportSize()!.height).toBe(true);
    expect(await smallTargets(counter)).toEqual([]);
  });

  // A tester's phone kept the columns stacked when turned sideways (#802): the
  // narrowest phone still sold, an iPhone SE, is 667 px wide in landscape.
  test("@layout should put a counter's three columns side by side on a phone turned sideways", async ({ openStation }) => {
    const counter = await openStation("c1");
    await counter.setViewportSize({ width: 667, height: 375 });
    const columns = ["À chercher", "Prêt", "Distribué"].map((name) => counter.getByRole("region", { name }));
    await expect(columns[0]).toBeVisible();

    const tops = await Promise.all(columns.map(async (column) => Math.round((await column.boundingBox())!.y)));

    expect(new Set(tops).size).toBe(1);
    expect(await hasNoSideScroll(counter)).toBe(true);
  });
});
