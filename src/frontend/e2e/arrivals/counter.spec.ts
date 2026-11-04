import type { Page } from "@playwright/test";

import { expect, test } from "./support/test";

const MUTED_BANNER = "Son coupé par le navigateur";

/**
 * The first touch of the page unlocks the sound, and the banner that says it is
 * muted goes away. A touch on the title is that first touch.
 */
async function unlockSound(page: Page) {
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByText(MUTED_BANNER)).toBeHidden();
}

test.describe("counter station", () => {
  test("should show a scanned badge at once, then move it to ready, delivered, and back", async ({ openStation }) => {
    const counter = await openStation("c1");
    const scan = await openStation("scan");
    const toFetch = counter.getByRole("region", { name: "À chercher" });
    const ready = counter.getByRole("region", { name: "Prêt" });
    const delivered = counter.getByRole("region", { name: "Distribué" });
    await expect(toFetch).toBeVisible();
    await unlockSound(counter);
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();

    // The badge arrives on the counter's screen, which nobody touched.
    await scan.getByLabel(/Pas de confirmation/).fill("Testguichet");
    await scan.getByRole("button", { name: /Charlie Testguichet/ }).click();
    const card = toFetch.getByRole("button", { name: "Badge 1 1 02, Charlie Testguichet : passer en Prêt" });
    await expect(card).toBeVisible();

    await card.click();
    const readyCard = ready.getByRole("button", { name: "Badge 1 1 02, Charlie Testguichet : passer en Distribué" });
    await expect(readyCard).toBeVisible();
    await expect(toFetch).not.toContainText("Charlie Testguichet");

    await readyCard.click();
    const deliveredCard = delivered.getByRole("button", { name: "Badge 1 1 02, Charlie Testguichet : revenir en Prêt" });
    await expect(deliveredCard).toBeVisible();

    await deliveredCard.click();
    await expect(ready.getByRole("button", { name: /Charlie Testguichet : passer en Distribué/ })).toBeVisible();
    await expect(delivered).not.toContainText("Charlie Testguichet");
  });

  // Found by this suite: the "Son coupé" banner used to go on pointerdown and
  // move the cards before the click, so a volunteer's first touch on a card
  // did nothing (CounterBoard.tsx).
  test("should move a card on the very first touch of the page", async ({ openStation }) => {
    const counter = await openStation("c1");
    const scan = await openStation("scan");
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    await scan.getByLabel(/Pas de confirmation/).fill("Testguichet");
    await scan.getByRole("button", { name: /Charlie Testguichet/ }).click();
    const card = counter.getByRole("button", { name: /Charlie Testguichet : (passer en Prêt|revenir en Prêt|passer en Distribué)/ });
    await expect(card).toBeVisible();
    // The card may start in any column, left there by the test before: the
    // touch counts if the card leaves the one it was in.
    const nameBefore = (await card.getAttribute("aria-label")) ?? "";

    await card.click();

    await expect(counter.getByRole("button", { name: nameBefore, exact: true })).toHaveCount(0);
  });

  test("should find a person by name or number, here or at another counter (#802)", async ({ openStation, data }) => {
    const counterOne = await openStation("c1");
    const counterTwo = await openStation("c2");
    const scan = await openStation("scan");
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    await scan.getByLabel(/Pas de confirmation/).fill(data.attendees.counter.barcode);
    await scan.getByRole("button", { name: "Valider" }).click();
    await expect(counterOne.getByRole("button", { name: /Charlie Testguichet/ })).toBeVisible();

    // At another counter: where to send the person, nothing to touch.
    await counterTwo.getByRole("searchbox", { name: /Chercher quelqu/ }).fill("Testguichet");
    const results = counterTwo.getByRole("list", { name: "Résultats de la recherche" });
    await expect(results).toContainText("Au guichet 1, badge 1 1 02");
    await expect(results.getByRole("button", { name: "Voir la carte" })).toHaveCount(0);

    // At its own counter, by the number as printed: the card is pointed at.
    await counterOne.getByRole("searchbox", { name: /Chercher quelqu/ }).fill("1 1 02");
    await counterOne.getByRole("list", { name: "Résultats de la recherche" }).getByRole("button", { name: "Voir la carte" }).click();
    await expect(counterOne.locator(`#badge-card-${data.attendees.counter.id} button`).first()).toHaveClass(/ring-4/);
  });

  test("should not show another counter's badge", async ({ openStation }) => {
    const counterTwo = await openStation("c2");
    const scan = await openStation("scan");
    await expect(counterTwo.getByRole("region", { name: "À chercher" })).toBeVisible();
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();

    await scan.getByLabel(/Pas de confirmation/).fill("Testguichet");
    await scan.getByRole("button", { name: /Charlie Testguichet/ }).click();
    await expect(scan.getByText("Guichet 1", { exact: true })).toBeVisible();

    // An absence has no event to wait for: leave the stream time to deliver it, were it wrongly sent.
    await counterTwo.waitForTimeout(1_000);
    await expect(counterTwo.getByText("Charlie Testguichet")).toHaveCount(0);
  });
});
