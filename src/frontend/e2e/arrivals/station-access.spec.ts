import { expect, test } from "./support/test";

test.describe("station access by QR link", () => {
  test("should open the Scan station signed in, with no way to another screen", async ({ openStation }) => {
    const page = await openStation("scan");

    await expect(page).toHaveURL(/\/arrivees\/scan$/);
    await expect(page.getByRole("heading", { name: "Scan", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Changer de poste" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Me déconnecter" })).toHaveCount(0);
  });

  test("should open a counter station on its own counter", async ({ openStation }) => {
    const page = await openStation("c1");

    await expect(page).toHaveURL(/\/arrivees\/guichet\/1$/);
    await expect(page.getByRole("heading", { name: "Guichet 1", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "À chercher" })).toBeVisible();
  });

  test("should keep a station on its own screen when it asks for another", async ({ openStation }) => {
    const page = await openStation("scan");
    await expect(page.getByRole("heading", { name: "Scan", exact: true })).toBeVisible();

    await page.goto("/arrivees/aide");

    await expect(page).toHaveURL(/\/arrivees\/scan$/);
  });

  test("should refuse a link that is not one", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto("/arrivees/poste/not-a-station-token");

    await expect(page.getByText("Ce lien de poste n'est pas valable")).toBeVisible();
    await context.close();
  });
});
