import { describe, expect, it } from "vitest";
import { scoreContactMessage, DEFAULT_SPAM_THRESHOLD } from "./contact-spam.js";

const config = { threshold: DEFAULT_SPAM_THRESHOLD, allowedDomains: [] };

const base = { firstName: "Camille", lastName: "Martin", email: "camille.martin@example.com" };

describe("scoreContactMessage", () => {
  it("should quarantine the phishing received through the form (#767)", () => {
    const verdict = scoreContactMessage(
      {
        firstName: "Claire",
        lastName: "Dubois",
        email: "claire.dubois@prodmail.online",
        message:
          "Une journée de conférences web, cloud, IA et sécurité pour développeurs, le 19 novembre. Les tarifs de sponsoring Gold et la disponibilité d'un stand, dossier ici : https://partagepro.online/fr/med/devfesttoulouse",
      },
      config,
    );

    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.reasons).toEqual(["external_link", "risky_tld:.online", "site_pitch"]);
    expect(verdict.score).toBe(5);
  });

  it("should quarantine a bare risky domain without a scheme", () => {
    const verdict = scoreContactMessage(
      { ...base, message: "Toutes les infos sur notre offre partenaire : dossier-sponsor.top/devfest" },
      config,
    );

    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.reasons).toEqual(["external_link", "risky_tld:.top"]);
  });

  it("should quarantine a link in the name on its own", () => {
    const verdict = scoreContactMessage(
      { ...base, firstName: "Gagnez un iPhone", lastName: "bit.ly/promo", message: "Bonjour, je souhaite des informations." },
      config,
    );

    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.reasons).toEqual(["link_in_identity"]);
  });

  it("should quarantine an explicit link in the company field", () => {
    const verdict = scoreContactMessage(
      { ...base, company: "https://example.net/offre", message: "Bonjour, je souhaite la brochure sponsor." },
      config,
    );

    expect(verdict.reasons).toContain("link_in_identity");
    expect(verdict.isSuspicious).toBe(true);
  });

  it("should quarantine a disposable address linking out", () => {
    const verdict = scoreContactMessage(
      { ...base, email: "x1234@yopmail.com", message: "Voir notre proposition ici : https://example.org/deck" },
      config,
    );

    expect(verdict.reasons).toEqual(["external_link", "disposable_email"]);
    expect(verdict.isSuspicious).toBe(true);
  });

  it("should let a real brochure request through", () => {
    const verdict = scoreContactMessage(
      {
        ...base,
        email: "camille.martin@airbus.com",
        company: "Airbus",
        jobTitle: "Responsable relations écoles",
        message: "Bonjour, nous aimerions recevoir la plaquette sponsor 2026 pour un stand. Merci !",
      },
      config,
    );

    expect(verdict).toEqual({ score: 0, reasons: [], isSuspicious: false });
  });

  it("should let a message with one ordinary link through", () => {
    const verdict = scoreContactMessage(
      { ...base, message: "Bonjour, voici le dépôt de notre atelier : https://github.com/gdg-toulouse/atelier. Bonne journée." },
      config,
    );

    expect(verdict.isSuspicious).toBe(false);
    expect(verdict.score).toBe(2);
  });

  it("should not take an e-mail address or a missing space for a link", () => {
    const verdict = scoreContactMessage(
      { ...base, message: "Écrivez-moi sur camille@gmail.com si besoin.Merci pour tout." },
      config,
    );

    expect(verdict.score).toBe(0);
  });

  it("should not take a dotted name for a link", () => {
    const verdict = scoreContactMessage({ ...base, lastName: "St.Clair", company: "Ippon.tech", message: "Bonjour à toute l'équipe !" }, config);

    expect(verdict.score).toBe(0);
  });

  it("should let our own domain and the allowed domains through", () => {
    const message = "Lien vers https://devfesttoulouse.fr/fr/programme et https://www.gdgtoulouse.fr/agenda";

    expect(scoreContactMessage({ ...base, message }, config).reasons).toEqual(["external_link"]);
    expect(scoreContactMessage({ ...base, message }, { ...config, allowedDomains: ["gdgtoulouse.fr"] }).score).toBe(0);
  });

  it("should be suspicious exactly at the threshold", () => {
    const verdict = scoreContactMessage(
      { ...base, message: "Infos : https://example.org/x" },
      { threshold: 2, allowedDomains: [] },
    );

    expect(verdict).toEqual({ score: 2, reasons: ["external_link"], isSuspicious: true });
  });
});
