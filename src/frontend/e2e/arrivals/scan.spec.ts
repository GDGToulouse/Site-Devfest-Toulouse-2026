import type { Page } from "@playwright/test";

import { expect, showToCamera, test } from "./support/test";

async function typeCode(page: Page, code: string) {
  await page.getByLabel(/Pas de confirmation/).fill(code);
  await page.getByRole("button", { name: "Valider" }).click();
}

test.describe("scan station", () => {
  test("should tell the counter and the badge number of a ticket read by the camera", async ({ openStation, data }) => {
    const page = await openStation("scan");
    await showToCamera(page, data.attendees.camera.qr);

    await page.getByRole("button", { name: "Scanner un billet" }).click();

    await expect(page.getByText("Guichet 1", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("1 1 01", { exact: true })).toBeVisible();
    await expect(page.getByText("Camille Testcamera")).toBeVisible();
    await expect(page.getByRole("button", { name: "Scanner le suivant" })).toBeVisible();
  });

  test("should undo a scan within the minute: the card leaves the counter, a new scan counts again (#797)", async ({
    openStation,
    data,
  }) => {
    const counter = await openStation("c1");
    const page = await openStation("scan");
    await expect(page.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    await typeCode(page, data.attendees.undo.barcode);
    const card = counter.getByRole("button", { name: /Eden Testannulation/ });
    await expect(card).toBeVisible();

    await page.getByRole("button", { name: "Annuler ce scan" }).click();
    await page.getByRole("button", { name: /Confirmer : annuler le scan de Eden Testannulation/ }).click();

    await expect(page.getByRole("status").filter({ hasText: "Scan annulé" })).toBeVisible();
    await expect(card).toHaveCount(0);
    await typeCode(page, data.attendees.undo.barcode);
    await expect(page.getByText("1 1 06", { exact: true })).toBeVisible();
    await expect(page.getByText("Déjà scanné")).toHaveCount(0);
  });

  test("should tell the counter and the badge number of a person found by name", async ({ openStation }) => {
    const page = await openStation("scan");

    await page.getByLabel(/Pas de confirmation/).fill("Testrecherche");
    await page.getByRole("button", { name: /Dominique Testrecherche/ }).click();

    await expect(page.getByText("Guichet 2", { exact: true })).toBeVisible();
    await expect(page.getByText("2 1 01", { exact: true })).toBeVisible();
  });

  test("should find a person without their accents", async ({ openStation }) => {
    const page = await openStation("scan");

    await page.getByLabel(/Pas de confirmation/).fill("dominique");

    await expect(page.getByRole("list", { name: "Résultats de la recherche" })).toContainText("Dominique Testrecherche");
  });

  test("should refuse a cancelled ticket", async ({ openStation, data }) => {
    const page = await openStation("scan");

    await typeCode(page, data.attendees.cancelled.barcode);

    await expect(page.getByText("Billet annulé", { exact: true })).toBeVisible();
    await expect(page.getByText("Claude Testannule")).toBeVisible();
  });

  test("should warn that a ticket was already scanned, and still say where to go", async ({ openStation, data }) => {
    const page = await openStation("scan");

    await typeCode(page, data.attendees.already.barcode);

    await expect(page.getByRole("alert").filter({ hasText: "Déjà scanné" })).toContainText("Poste Scan");
    await expect(page.getByText("Guichet 2", { exact: true })).toBeVisible();
    await expect(page.getByText("2 1 02", { exact: true })).toBeVisible();
  });

  test("should send a dedicated-flow ticket to the dedicated reception", async ({ openStation, data }) => {
    const page = await openStation("scan");

    await typeCode(page, data.attendees.dedicated.barcode);

    await expect(page.getByText("Accueil dédié", { exact: true })).toBeVisible();
    await expect(page.getByText("Sacha Testspeaker")).toBeVisible();
  });

  test("should send a ticket with no printed badge to the help desk", async ({ openStation, data }) => {
    const page = await openStation("scan");

    await typeCode(page, data.attendees.nobadge.barcode);

    await expect(page.getByText("Guichet d'aide", { exact: true })).toBeVisible();
    await expect(page.getByText("Pas de badge imprimé pour ce billet.")).toBeVisible();
  });

  test("should say that a code is unknown", async ({ openStation }) => {
    const page = await openStation("scan");

    await typeCode(page, "9999999999");

    await expect(page.getByText("Code inconnu", { exact: true })).toBeVisible();
  });
});
