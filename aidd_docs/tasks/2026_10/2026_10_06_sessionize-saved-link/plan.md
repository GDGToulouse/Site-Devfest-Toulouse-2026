---
objective: "Une fois un import Sessionize réussi depuis son URL, l'édition garde ce lien : l'admin relance l'import d'un clic ou supprime le lien, sans jamais le recoller."
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Lien d'import Sessionize gardé par édition (#529)

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Stocker l'URL de l'API Sessionize sur l'édition après un import réussi, et offrir « Mettre à jour les données » et « Supprimer le lien » dans l'onglet d'import |
| **Source** | Issue GitHub `GDGToulouse/Site-Devfest-Toulouse-2026#529` et son commentaire de qualification |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Backend — colonne `Edition.sessionizeApiUrl`, import depuis le lien gardé, lecture et suppression du lien | [`phase-1.md`](./phase-1.md) |
| 2   | Admin — l'onglet d'import affiche le lien gardé, ses deux boutons, et suit l'édition choisie | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Le lien est une colonne de `Edition`, pas un `SiteSetting` global | Un événement Sessionize correspond à une édition, comme les associations de salles `SessionizeRoom` déjà rangées par édition ; changer d'édition dans le sélecteur ne doit jamais réimporter le lien d'une autre année |
| Distinct du réglage `cfp_sessionize_url` | Celui-ci est la page publique d'appel à orateurs affichée aux visiteurs ; le lien d'import est un endpoint API, réservé au back-office |
| Le lien n'est enregistré qu'après un import réussi depuis une URL | Ne jamais garder une URL qui a échoué ; l'import par JSON collé ne touche pas au lien |
| Supprimer le lien est réservé aux ADMIN ; l'équipe (ADMIN, EDITOR) le lit et s'en sert pour réimporter | Décision du 2026-10-06 : un éditeur relance l'import comme aujourd'hui, mais ne retire pas le lien que l'équipe partage ; la règle vit au backend (`requireAdminRole`), l'écran ne fait que la refléter |
| La garde SSRF `validateWebhookUrl` reste appliquée à chaque fetch, lien gardé compris | Une valeur relue de la base est une entrée utilisateur comme une autre (#306) |
