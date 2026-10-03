---
objective: "Avant le 16 octobre 2026, un contact sponsor ne peut plus recevoir de rôle back-office, l'invitation sponsor explique l'espace partenaire, un sponsor voit son compte et gère son mot de passe, et le tout est en production avec #507 et la redirection /conferences-list."
status: pending
---

# Plan: Vague 1 — sécurité et parcours sponsor, puis mise en production

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Livrer #500, #505 et #411 sur `dev-j`, puis promouvoir `dev-j → dev → main` avant l'échéance sponsors du 16 octobre |
| **Source** | Issues #500, #505, #411 (bodies et qualifications), plan de priorisation du 2026-10-03, décisions de Julien du 2026-10-03 |

## Phases

| #   | Phase                                                         | File                         |
| --- | ------------------------------------------------------------- | ---------------------------- |
| 1   | #500 backend — rôles verrouillés et sponsors rattachés         | [`phase-1.md`](./phase-1.md) |
| 2   | #500 admin — badge Sponsor, sociétés, pas de promotion         | [`phase-2.md`](./phase-2.md) |
| 3   | #505 — e-mail d'invitation sponsor qui explique l'espace       | [`phase-3.md`](./phase-3.md) |
| 4   | #411 backend — identité et URL de réinitialisation par rôle    | [`phase-4.md`](./phase-4.md) |
| 5   | #411 espace sponsor — compte, mot de passe, mot de passe oublié | [`phase-5.md`](./phase-5.md) |
| 6   | Mise en production de la vague (avec #507 et #386)             | [`phase-6.md`](./phase-6.md) |

Une branche par issue, partie de `dev-j`, mergée en classique : `fix/us-500-sponsor-role-lock` (phases 1-2), `feature/us-505-sponsor-invitation-email` (phase 3), `feature/us-411-sponsor-account` (phases 4-5). Phase 1 avant 2, phase 4 avant 5 ; #505 est indépendante. La phase 6 attend que les trois soient sur `dev-j` et vérifiées sur `dev-j.site.devfesttoulouse.fr`.

## Decisions

| Decision | Why |
| -------- | --- |
| Le serveur refuse tout changement de rôle d'un compte `SPONSOR` et n'accepte que `ADMIN`/`EDITOR` en écriture | L'autorisation qui fait foi est celle du backend ; masquer le sélecteur seul laisse la promotion possible par l'API (`.claude/rules/security.md`) |
| Pas de `replyTo` sur l'invitation : « répondez à cet e-mail » vise `SMTP_FROM` | Julien confirme que l'adresse d'envoi de prod est une boîte lue (2026-10-03) |
| L'URL de réinitialisation dépend du rôle stocké (`SPONSOR` → `/sponsor/reset-password`) | Un seul `sendResetPassword` sert les deux publics ; un lien vers `/admin` mène un sponsor dans un mur |
| Composant d'identité propre à l'espace sponsor, pas d'extraction depuis `AdminSidebar` | Le bloc admin est inliné dans une sidebar au style différent ; une seule réutilisation ne justifie pas l'abstraction (`.claude/rules/code-quality.md`) |
