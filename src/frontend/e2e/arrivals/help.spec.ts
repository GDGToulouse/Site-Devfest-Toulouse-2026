import { expect, showToCamera, test } from "./support/test";

test.describe("help station", () => {
  test("should list a ticket without badge, print its label, then record it as handed over", async ({ openStation, data }) => {
    const help = await openStation("help");
    const scan = await openStation("scan");
    const toHandle = help.getByRole("region", { name: /À traiter/ });
    await expect(toHandle).toBeVisible();
    await expect(scan.getByRole("status").filter({ hasText: "Connecté" })).toBeVisible();

    // The Scan phone sends the person to the help desk, whose screen follows live.
    await scan.getByLabel(/Pas de confirmation/).fill(data.attendees.help.barcode);
    await scan.getByRole("button", { name: "Valider" }).click();
    await expect(scan.getByText("Cas particuliers", { exact: true })).toBeVisible();
    const entry = toHandle.getByRole("button", { name: /Noa Testaide/ });
    await expect(entry).toBeVisible();

    await entry.click();
    await help.getByRole("button", { name: "Imprimer l'étiquette" }).click();
    await expect(help.getByRole("button", { name: /Réimprimer/ })).toBeVisible();

    // The print dialog was asked for, and what it would print is the label alone, at the roll's size.
    expect(await help.evaluate(() => (window as unknown as { __e2ePrints: number }).__e2ePrints)).toBe(1);
    await help.emulateMedia({ media: "print" });
    await expect(help.locator(".print-only")).toContainText("Noa");
    await expect(help.locator(".print-only")).toContainText("Testaide");
    await expect(help.getByRole("heading", { name: "Cas particuliers", exact: true })).toBeHidden();
    const pdf = await help.pdf({ preferCSSPageSize: true });
    const mediaBox = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString("latin1"));
    // 100 × 150 mm, the default roll, in PDF points (1 pt = 1/72 in).
    expect(Math.abs(Number(mediaBox?.[1]) - 283.5)).toBeLessThan(2);
    expect(Math.abs(Number(mediaBox?.[2]) - 425.2)).toBeLessThan(2);
    await help.emulateMedia({ media: "screen" });

    await help.getByRole("button", { name: "Étiquette remise" }).click();
    await expect(help.getByRole("status").filter({ hasText: "Arrivée enregistrée : Noa Testaide" })).toBeVisible();
    await expect(toHandle.getByRole("button", { name: /Noa Testaide/ })).toHaveCount(0);
  });

  // The fixture's cancelled ticket has a printed badge: a refund after the freeze.
  test("should list a refunded badge to take back, until the desk has it (#800)", async ({ openStation }) => {
    const help = await openStation("help");
    const list = help.getByRole("region", { name: /Badges à retirer/ });
    const entry = list.getByRole("listitem").filter({ hasText: "Claude Testannule" });
    await expect(entry).toContainText("1 1 03");
    await expect(entry).toContainText("Dans son présentoir, guichet 1");

    await entry.getByRole("button", { name: "Badge récupéré" }).click();

    await expect(help.getByRole("region", { name: /Badges à retirer/ })).toHaveCount(0);
  });

  test("should open a person's page from a ticket read at the desk (#801)", async ({ openStation, data }) => {
    const help = await openStation("help");
    await showToCamera(help, data.attendees.search.qr);

    await help.getByRole("button", { name: "Scanner un billet" }).click();

    await expect(help.getByRole("heading", { name: "Dominique Testrecherche" })).toBeVisible({ timeout: 20_000 });
  });

  test("should print the corrected text, centred, with the badges' QR code (#801)", async ({ openStation }) => {
    const help = await openStation("help");
    await help.getByRole("searchbox", { name: /Chercher quelqu/ }).fill("Testsansbadge");
    await help.getByRole("button", { name: /Nael Testsansbadge/ }).click();

    await help.getByLabel("Prénom *", { exact: true }).fill("Naël");
    await help.getByRole("button", { name: /Imprimer l'étiquette|Réimprimer/ }).click();

    const sheet = help.locator(".print-only");
    await expect(sheet).toContainText("Naël");
    // The sheet only shows in print: looked up by tag, not by role.
    await expect(sheet.locator('img[alt="QR code du billet"]')).toHaveCount(1);
  });

  test("should print a label for a person without a ticket, company required, no QR code (#801)", async ({ openStation }) => {
    const help = await openStation("help");
    await help.getByRole("button", { name: "Étiquette sans billet" }).click();
    const form = help.getByRole("region", { name: "Étiquette sans billet" });
    await form.getByLabel("Prénom *", { exact: true }).fill("Sam");
    await form.getByLabel("Nom *", { exact: true }).fill("Presta");

    await form.getByRole("button", { name: "Imprimer l'étiquette sans billet" }).click();
    await expect(help.getByText("Prénom, nom et entreprise sont obligatoires")).toBeVisible();
    await form.getByLabel("Entreprise *", { exact: true }).fill("Traiteur Garonne");
    await form.getByRole("button", { name: "Imprimer l'étiquette sans billet" }).click();

    await expect(help.getByRole("status").filter({ hasText: "Étiquette sans billet imprimée pour Sam Presta" })).toBeVisible();
    const sheet = help.locator(".print-only");
    await expect(sheet).toContainText("Traiteur Garonne");
    await expect(sheet.locator("img")).toHaveCount(0);
  });
});
