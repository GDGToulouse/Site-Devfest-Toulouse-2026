# Project Brief

## What it is

- Le site du DevFest Toulouse, conférence tech annuelle du GDG Toulouse : site public bilingue FR/EN, back-office pour l'équipe, espace partenaire pour les sponsors.

## Why it exists

- Remplacer le WordPress (Avada) des éditions 2023-2025 par un site durable, qu'on reconduit d'une édition à l'autre sans le refaire, et qui garde l'historique depuis 2016.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Édition | Une année du DevFest. Son statut (`PREPARATION`, `ANNOUNCEMENT`, `TICKETING`, `PROGRAMME`, `EVENT_DAY`, `SEE_YOU_NEXT_YEAR`) conditionne la page d'accueil, et l'en-tête de toutes les pages |
| Speaker | Une personne, partagée entre éditions. Sa participation à une année est un `SpeakerEdition` |
| Talk | Une session : conférence, keynote, atelier |
| Sponsor | Une entreprise, partagée entre éditions. Sa participation est un `EditionSponsor`, qui fige le logo et le libellé de niveau affichés cette année-là (#375) |
| Niveau | Le palier de sponsoring (`SponsorTier`), décliné par édition (`EditionSponsorTier`) |
| Contact sponsor | Le compte d'un collaborateur de l'entreprise, avec un rôle d'accès `RESPONSABLE`, `EDITEUR` ou `STAND` |
| Lien de modification | `/edit/<token>` : un speaker modifie sa fiche sans compte |
| Programme / grille | Les créneaux (`ScheduleEntry`) d'une édition, par salle (`Room`) |
| Replay | La vidéo YouTube d'un talk passé |
| Corbeille | Suppression douce, avec purge différée |
| Lot | Un lot de développement, suivi en milestone GitHub |

## Key features

- Accueil qui change selon le statut de l'édition
- Programme : grille par salle, favoris, export calendrier, impression
- Speakers, talks, replays, archives des éditions passées
- Sponsors, hall of fame, offres d'emploi partenaires, espace partenaire
- Actualités, pages de contenu, formulaire de contact
- Back-office : éditions, contenus, import Sessionize, traduction assistée, fichiers, corbeille, clés API
- API publique documentée en OpenAPI

Périmètre détaillé : `docs/fonctionnalites-2026.md`.
