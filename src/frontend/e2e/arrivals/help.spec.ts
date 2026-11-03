import { expect, test } from "./support/test";

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
    await expect(scan.getByText("Guichet d'aide", { exact: true })).toBeVisible();
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
    await expect(help.getByRole("heading", { name: "Aide", exact: true })).toBeHidden();
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
});
