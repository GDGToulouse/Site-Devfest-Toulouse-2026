import { expect, showToCamera, test } from "./support/test";
import { BACKEND_CONTAINER, docker, waitForBackend } from "./support/backend";

// The backend really stops here, not the browser's network: the streams are cut
// by the server, the way a crashed or redeployed backend cuts them. The dev
// container reinstalls and regenerates before it answers again, which is why
// this runs apart from the rest (`outage` project).

test.describe("network outage", () => {
  test("@outage should answer from the offline table, then record the scan when the backend is back", async ({
    openStation,
    data,
  }) => {
    test.setTimeout(300_000);
    const scan = await openStation("scan");
    const counter = await openStation("c1");
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    await expect(counter.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    // The phone must hold the table before the outage: it is fetched on connection.
    await expect
      .poll(() => scan.evaluate((id) => localStorage.getItem(`devfest-arrivals-offline-${id}`) !== null, data.editionId))
      .toBe(true);

    try {
      docker("stop", "--time", "1", BACKEND_CONTAINER);
      await expect(scan.getByRole("status").filter({ hasText: "Déconnecté" })).toBeVisible({ timeout: 30_000 });

      await showToCamera(scan, data.attendees.outage.qr);
      await scan.getByRole("button", { name: "Scanner un billet" }).click();
      await expect(scan.getByText("Mode dégradé : scan gardé sur ce téléphone")).toBeVisible({ timeout: 20_000 });
      await expect(scan.getByText("Guichet 1", { exact: true })).toBeVisible();
      await expect(scan.getByText("1 1 04", { exact: true })).toBeVisible();
      await expect(scan.getByRole("status").filter({ hasText: "1 à envoyer" })).toBeVisible();
    } finally {
      docker("start", BACKEND_CONTAINER);
    }
    await waitForBackend();

    // Back: the phone sends its scan, and the counter's card says it came from the outage.
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible({ timeout: 60_000 });
    await expect(scan.getByText(/Scans faits sans le serveur : 1 enregistré/)).toBeVisible({ timeout: 60_000 });
    const card = counter.getByRole("region", { name: "À chercher" }).getByRole("button", { name: /Olivia Testcoupure/ });
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Scanné pendant la coupure");
  });
});
