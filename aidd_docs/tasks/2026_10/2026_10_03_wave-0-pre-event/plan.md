---
objective: "Les risques et pertes immédiats d'avant l'événement sont neutralisés : aucun contact sponsor n'a accès au back-office, les ventes depuis le site sont suivies, la collecte Emmaüs est annoncée, les liens entrants connus aboutissent, et le sort des stands 2026 est tranché."
status: blocked
---

# Plan: Vague 0 — actions immédiates avant le DevFest 2026

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Traiter cette semaine ce qui coûte déjà (sécurité, suivi des ventes, liens morts) ou qui a une échéance proche (stands au 16 octobre), presque sans développement |
| **Source** | Plan de priorisation du 2026-10-03 (conversation), « Vague 0 » — issues #500 (tâche 1), #507 (contournement), #490, #386, #438 / #485 (décision) |

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Audit des rôles stockés en prod et en beta (#500)        | [`phase-1.md`](./phase-1.md) |
| 2   | Suivi Billetweb rétabli par les données (#507)            | [`phase-2.md`](./phase-2.md) |
| 3   | Page « Nos engagements » publiée (#490)                   | [`phase-3.md`](./phase-3.md) |
| 4   | Liens entrants réparés et écosystème contacté (#386)      | [`phase-4.md`](./phase-4.md) |
| 5   | Stands 2026 : décision consignée (#438, #485)             | [`phase-5.md`](./phase-5.md) |

Les phases sont indépendantes et peuvent se mener dans n'importe quel ordre. Ordre recommandé : 1 (sécurité) puis 2 (chaque vente non suivie est perdue pour la mesure), puis 5 avant le 16 octobre.

## Resources

| Source | Verified |
| ------ | -------- |
| `https://devfesttoulouse.fr/api/editions/current/ticket-tiers` (2026-10-03) | Les 3 tarifs visibles (ids 40, 41, 44) portent `https://www.billetweb.fr/shop.php?event=devfest-toulouse-2026` ; seul « Normal » (44) est `AVAILABLE` |
| `https://devfesttoulouse.fr/conferences-list/` (2026-10-03) | 308 → `/conferences-list` → **404** sur `/fr/conferences-list` : le lien entrant GDG cité en #386 tombe toujours dans le vide, bien que #380 soit fermée |
| Commentaire de clôture de #380 | Les redirections héritées vivent côté infra (GDGToulouse/DevFestToulouse-infra#17), pas dans ce dépôt ; `/conferences-list` n'y est pas couvert |

## Decisions

| Decision | Why |
| -------- | --- |
| Corriger #507 par les données maintenant, le code en vague 1 | Le contournement est immédiat ; le correctif de l'import (`tickets.ts:135`) doit suivre, sinon un réimport Billetweb efface la correction |
| Redirection `/conferences-list` posée dans `next.config.ts`, pas dans l'infra | Seul morceau de code de la vague : une ligne, testable dans ce dépôt, et déployée avec le site ; l'infra garde les sous-domaines annuels |
