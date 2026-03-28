# Lot 4 — Contenu complémentaire

**Échéance** : octobre 2026
**Objectif** : toutes les pages publiques sont en place pour la communication finale.

**Prérequis** : Lots 1-3 livrés et en production.

---

## Table des matières

1. [Règles de gestion](#règles-de-gestion)
2. [User stories — Lieu](#user-stories--lieu)
3. [User stories — Infos pratiques](#user-stories--infos-pratiques)
4. [User stories — Équipe](#user-stories--équipe)
5. [User stories — FAQ](#user-stories--faq)
6. [User stories — Historique / À propos](#user-stories--historique--à-propos)
7. [User stories — Hall of replays](#user-stories--hall-of-replays)
8. [User stories — Galerie photos](#user-stories--galerie-photos)
9. [User stories — Admin](#user-stories--admin)
10. [Parcours utilisateur](#parcours-utilisateur)
11. [Cas limites et erreurs](#cas-limites-et-erreurs)
12. [Questions ouvertes](#questions-ouvertes)

---

## Règles de gestion

### Lieu

| # | Règle |
|---|-------|
| RG-400 | La page Lieu affiche les informations du lieu associé à l'édition courante. |
| RG-401 | Les informations affichées sont : nom du lieu, description (FR + EN), adresse postale, lien itinéraire (Google Maps), informations pratiques (transports, parking, plan intérieur). |
| RG-402 | Une carte interactive Leaflet + OpenStreetMap est intégrée sur la page. |
| RG-403 | La carte utilise un chargement différé (lazy loading) pour ne pas pénaliser les performances. |
| RG-404 | Le lieu est une entité réutilisable : si le DevFest se tient au même endroit plusieurs années, le lieu et ses salles sont partagés. |

### Équipe

| # | Règle |
|---|-------|
| RG-410 | La page Équipe affiche la liste des organisateurs du DevFest Toulouse. |
| RG-411 | Chaque membre affiche : photo, nom, rôle dans l'organisation, liens sociaux. |
| RG-412 | Les membres de l'équipe sont affichés par ordre alphabétique (nom de famille). |
| RG-413 | Les membres d'équipe sont associés à l'édition courante. |

### FAQ

| # | Règle |
|---|-------|
| RG-420 | La FAQ est une liste de questions/réponses organisée par thème. |
| RG-421 | Le contenu est bilingue (FR + EN). |
| RG-422 | Les questions sont présentées sous forme d'accordéon (expandable/collapsible). |
| RG-423 | Les questions sont accessibles au clavier (Enter/Space pour ouvrir/fermer, navigation par flèches). |
| RG-424 | Les données structurées Schema.org `FAQPage` sont générées pour le SEO. |
| RG-425 | Les thèmes habituels sont : Accès au lieu, Formats des talks, Billetterie, Remboursement, Accessibilité, Divers. |

### Historique / À propos

| # | Règle |
|---|-------|
| RG-430 | La page À propos / Historique présente le GDG Toulouse et l'histoire du DevFest. |
| RG-431 | Une frise chronologique affiche les éditions passées (2016 à 2025). Composant custom en CSS (liste verticale avec points et ligne de connexion), sans librairie externe. |
| RG-432 | Chaque entrée de la frise affiche : année, lieu, nombre de participants, nombre de sessions, lien vers le site archivé. |
| RG-433 | La frise utilise les données de `data/devfest-history.json` (speakers et sessions) et les métadonnées des éditions (nombre de participants, lieu, etc. stockés comme données admin-éditables dans l'entité édition — ces informations ne sont pas dans devfest-history.json). |
| RG-434 | Des liens vers les sites archivés des éditions précédentes sont fournis (ex. `2019.devfesttoulouse.fr`). |
| RG-435 | Le contenu textuel de présentation du GDG est bilingue (FR + EN). |

### Hall of replays

| # | Règle |
|---|-------|
| RG-440 | Le Hall of replays affiche l'historique de toutes les conférences de toutes les éditions ayant des vidéos. |
| RG-441 | Les données proviennent de `data/devfest-history.json` (champ `youtube` des sessions). |
| RG-442 | Les sessions sont groupées par édition (année), de la plus récente à la plus ancienne. |
| RG-443 | Chaque session avec vidéo affiche : titre, speaker(s), édition (année), player YouTube intégré (lazy loading) et lien « Regarder sur YouTube ». |
| RG-444 | Un filtre par édition (année) est disponible. |
| RG-445 | Une recherche texte sur le titre et le speaker est disponible. |

### Galerie photos

| # | Règle |
|---|-------|
| RG-450 | La page Galerie photos affiche une mini galerie de miniatures (photos sélectionnées) avec un lien vers les albums Google Photos complets. |
| RG-451 | Deux types d'albums sont distingués : l'album officiel et l'album collaboratif (contributif par les participants). |
| RG-452 | Les albums sont associés à l'édition courante. Si des albums d'éditions précédentes existent, ils sont listés en dessous. |

---

## User stories — Lieu

### US-400 : Page Lieu

**En tant que** visiteur,
**je veux** connaître le lieu de l'événement et comment m'y rendre,
**afin de** préparer mon déplacement.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Lieu.
- [ ] Nom du lieu (ex. « Centre de Congrès Diagora ») en titre principal.
- [ ] Description du lieu (dans la langue de la page) (RG-401).
- [ ] Adresse postale complète.
- [ ] Bouton « Itinéraire » menant vers Google Maps (lien externe, nouvel onglet).
- [ ] Carte Leaflet + OpenStreetMap intégrée avec lazy loading (RG-402, RG-403).
- [ ] La carte utilise un chargement différé (façade ou lazy loading) pour la performance.
- [ ] `<title>` : « Lieu — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.
- [ ] Données structurées Schema.org `Place` avec `name`, `address`, `geo`.

## User stories — Infos pratiques

### US-405 : Page Infos pratiques

**En tant que** visiteur,
**je veux** consulter les informations pratiques pour me rendre à l'événement,
**afin de** préparer ma venue en connaissant les options de transport, parking et l'agencement des lieux.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Infos pratiques.
- [ ] Section transport : moyens d'accès (métro/tram/bus, lignes et arrêts à proximité, navette si applicable).
- [ ] Section parking : parkings disponibles à proximité, capacité indicative, tarifs si connus.
- [ ] Section plan du lieu : plan intérieur (floor plan) du lieu avec les salles, les stands, les espaces de restauration et les points d'intérêt.
- [ ] Les informations sont saisies par l'admin dans le back-office (champ de contenu riche bilingue FR + EN).
- [ ] `<title>` : « Infos pratiques — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

---

## User stories — Équipe

### US-410 : Page Équipe

**En tant que** visiteur,
**je veux** voir qui organise le DevFest Toulouse,
**afin de** mettre un visage sur l'équipe.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Équipe.
- [ ] Grille de membres de l'équipe (4 colonnes desktop, 2 tablette, 1 mobile).
- [ ] Chaque membre affiche : photo, nom, rôle, liens sociaux (icônes cliquables).
- [ ] Les membres sont affichés par ordre alphabétique (RG-412).
- [ ] `<title>` : « Équipe — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

---

## User stories — FAQ

### US-420 : Page FAQ

**En tant que** visiteur,
**je veux** trouver rapidement des réponses à mes questions pratiques,
**afin de** préparer ma participation au DevFest.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > FAQ.
- [ ] Questions organisées par thème (RG-425).
- [ ] Chaque question est un accordéon : clic pour déplier/replier la réponse (RG-422).
- [ ] Les accordéons sont accessibles au clavier (RG-423) : Enter/Space pour toggle, ARIA `role="button"`, `aria-expanded`, `aria-controls`.
- [ ] Plusieurs questions peuvent être ouvertes en même temps.
- [ ] `<title>` : « FAQ — DevFest Toulouse 2026 ».
- [ ] Données structurées Schema.org `FAQPage` (RG-424).
- [ ] La page est bilingue FR/EN (RG-421).

---

## User stories — Historique / À propos

### US-430 : Page À propos avec frise chronologique

**En tant que** visiteur,
**je veux** découvrir l'histoire du DevFest Toulouse,
**afin de** comprendre l'évolution de l'événement.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > À propos.
- [ ] Section de présentation du GDG Toulouse (texte bilingue).
- [ ] Frise chronologique interactive des éditions (2016 à 2025) (RG-431).
- [ ] Chaque point de la frise affiche : année, lieu, nombre de participants, nombre de sessions (RG-432).
- [ ] Lien « Voir le site » vers le site archivé de chaque édition (RG-434).
- [ ] La frise est verticale sur tous les écrans (cohérent avec le composant custom CSS en liste verticale — RG-431).
- [ ] Animation au scroll (apparition progressive des entrées).
- [ ] `<title>` : « À propos — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

---

## User stories — Hall of replays

### US-440 : Page Hall of replays

**En tant que** visiteur,
**je veux** parcourir les vidéos de toutes les éditions passées du DevFest,
**afin de** (re)voir des conférences qui m'intéressent.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Hall of replays.
- [ ] Sessions groupées par édition, de la plus récente à la plus ancienne (RG-442).
- [ ] Chaque session affiche : titre, speaker(s), player YouTube intégré (lazy loading) + lien « Regarder sur YouTube » (RG-443).
- [ ] Filtre par édition (dropdown ou onglets) (RG-444).
- [ ] Recherche texte sur titre et speaker (RG-445).
- [ ] Clic sur le lien YouTube → ouverture dans un nouvel onglet (ou player intégré).
- [ ] Les données proviennent de `data/devfest-history.json` (RG-441).
- [ ] `<title>` : « Hall of replays — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.
- [ ] Pagination ou lazy loading si le nombre de vidéos est important (7 éditions, potentiellement 100+ vidéos).

---

## User stories — Galerie photos

### US-450 : Page Galerie photos

**En tant que** visiteur,
**je veux** accéder aux photos de l'événement,
**afin de** revivre l'ambiance du DevFest.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Galerie photos.
- [ ] Mini galerie de miniatures avec liens vers les albums Google Photos complets (RG-450, RG-451) :
  - Album officiel (photographe)
  - Album collaboratif (participants)
- [ ] Chaque lien s'ouvre dans un nouvel onglet.
- [ ] Si des albums d'éditions précédentes existent, ils sont listés en dessous sous un titre « Éditions précédentes » (RG-452).
- [ ] `<title>` : « Galerie photos — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

---

## User stories — Admin

### US-460 : Gestion du lieu

**En tant qu'** admin,
**je veux** configurer le lieu de l'édition courante,
**afin de** alimenter la page Lieu.

**Critères d'acceptation :**
- [ ] Création/modification d'un lieu : nom, description (FR + EN), adresse, coordonnées GPS, lien itinéraire.
- [ ] Gestion des salles du lieu : nom, capacité (optionnel), ordre d'affichage.
- [ ] Association du lieu à l'édition courante.
- [ ] Possibilité de réutiliser un lieu existant d'une édition passée (RG-404).
- [ ] Après modification, purge du cache de la page Lieu.

### US-461 : Gestion de l'équipe

**En tant qu'** admin,
**je veux** gérer les membres de l'équipe organisatrice,
**afin de** publier la page Équipe.

**Critères d'acceptation :**
- [ ] CRUD des membres d'équipe : nom, photo, rôle, liens sociaux.
- [ ] Association des membres à l'édition courante (RG-413).
- [ ] Après modification, purge du cache de la page Équipe.

### US-462 : Gestion de la FAQ

**En tant qu'** admin,
**je veux** gérer les questions/réponses de la FAQ,
**afin de** les maintenir à jour.

**Critères d'acceptation :**
- [ ] CRUD des questions : question (FR + EN), réponse (FR + EN), thème, ordre d'affichage.
- [ ] Les thèmes sont libres (créés à la volée ou sélectionnés depuis une liste existante).
- [ ] Après modification, purge du cache de la page FAQ.

### US-463 : Gestion de la page À propos

**En tant qu'** admin,
**je veux** modifier le texte de présentation de la page À propos,
**afin de** mettre à jour le contenu.

**Critères d'acceptation :**
- [ ] Éditeur de contenu riche bilingue (FR + EN) pour le texte de présentation du GDG.
- [ ] La frise chronologique est alimentée automatiquement par les données des éditions (pas de saisie manuelle des données historiques).
- [ ] Après modification, purge du cache de la page À propos.

### US-464 : Gestion des albums photos

**En tant qu'** admin,
**je veux** ajouter les liens vers les albums Google Photos,
**afin d'** alimenter la page Galerie photos.

**Critères d'acceptation :**
- [ ] Ajout/modification de liens d'albums : URL, type (officiel/collaboratif), édition associée.
- [ ] Upload d'une sélection de photos (miniatures) pour la mini galerie de la page Galerie photos (RG-450). L'admin choisit les photos représentatives à afficher sur le site.
- [ ] Les miniatures sont redimensionnées et optimisées (WebP, taille max adaptée à l'affichage en grille).
- [ ] Après modification, purge du cache de la page Galerie photos.

---

## Parcours utilisateur

### Parcours 1 : Préparation logistique du visiteur

1. Le visiteur clique sur « Lieu » dans la navigation (ou via la page d'accueil).
2. Il voit le nom du lieu, la description, l'adresse.
3. Il clique sur « Itinéraire » → Google Maps s'ouvre avec la destination pré-remplie.
4. Il revient sur le site et consulte la FAQ.
5. Il ouvre la question « Comment se garer ? » → la réponse s'affiche.
6. Il ouvre la question « Y a-t-il un repas inclus ? » → la réponse s'affiche.

### Parcours 2 : Découverte de l'historique

1. Le visiteur clique sur « À propos » dans la navigation.
2. Il lit la présentation du GDG Toulouse.
3. Il scrolle et découvre la frise chronologique.
4. Il voit l'édition 2016 (IUT Blagnac, 300 participants) et l'évolution jusqu'à 2025.
5. Il clique sur « Voir le site 2019 » → le site archivé s'ouvre dans un nouvel onglet.

### Parcours 3 : Recherche d'un replay

1. Le visiteur clique sur « Hall of replays ».
2. Il voit les sessions groupées par édition (2025 en premier).
3. Il sélectionne l'édition 2024 dans le filtre.
4. Il tape « Kotlin » dans la recherche texte.
5. Il trouve une session et clique sur le lien YouTube → la vidéo s'ouvre.

### Parcours 4 : Admin met en place le contenu complémentaire

1. L'admin configure le lieu : nom, adresse, coordonnées, description FR/EN.
2. Il ajoute les salles (Salle Ampère, Salle Pasteur, etc.) avec leur ordre d'affichage.
3. Il ajoute les membres de l'équipe (photo, nom, rôle, réseaux sociaux).
4. Il crée les questions de la FAQ par thème.
5. Il met à jour le texte de la page À propos.
6. Il ajoute les liens vers les albums Google Photos.
7. Toutes les pages sont publiées et le cache est purgé.

---

## Cas limites et erreurs

### Lieu

| Cas | Comportement attendu |
|-----|---------------------|
| Aucun lieu associé à l'édition courante | La page Lieu affiche un message « Le lieu sera annoncé prochainement ». |
| Coordonnées GPS non renseignées | La carte intégrée est masquée, seul le lien itinéraire (via adresse textuelle) est affiché. |
| Tuiles OpenStreetMap/Leaflet indisponibles | Affichage d'une image statique de la carte en fallback, ou de l'adresse textuelle avec le lien itinéraire seul. |

### Équipe

| Cas | Comportement attendu |
|-----|---------------------|
| Aucun membre d'équipe pour l'édition courante | La page Équipe affiche un message « L'équipe sera présentée prochainement ». |
| Membre sans photo | Un placeholder est affiché (silhouette). |
| Membre sans liens sociaux | Aucune icône sociale n'est affichée pour ce membre. |

### FAQ

| Cas | Comportement attendu |
|-----|---------------------|
| Aucune question dans la FAQ | La page affiche un message « La FAQ sera bientôt disponible ». |
| Question sans thème | La question apparaît dans un groupe « Divers » / « Other ». |

### Hall of replays

| Cas | Comportement attendu |
|-----|---------------------|
| Édition sans aucune vidéo YouTube | L'édition n'apparaît pas dans la liste (rien à afficher). |
| Lien YouTube cassé (vidéo supprimée) | Le lien reste affiché ; l'utilisateur voit le message d'erreur YouTube. Pas de vérification automatique de la validité des liens. |
| Recherche sans résultat | Message « Aucun replay trouvé pour votre recherche ». |

### Galerie photos

| Cas | Comportement attendu |
|-----|---------------------|
| Aucun album configuré | La page affiche « Les photos seront bientôt disponibles ». |

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| ~~QO-040~~ | ~~Carte du lieu ?~~ **Résolu** : Leaflet + OpenStreetMap (open source, gratuit, pas de clé API). | — |
| ~~QO-041~~ | ~~Frise chronologique ?~~ **Résolu** : composant custom en CSS (liste verticale avec points et ligne). Pas de librairie externe — le volume de données (~10 éditions) ne le justifie pas. | — |
| ~~QO-042~~ | ~~Hall of replays : player ou liens ?~~ **Résolu** : player YouTube intégré (lazy loading pour les performances) avec un lien « Regarder sur YouTube ». | — |
| ~~QO-043~~ | ~~Infos pratiques lieu ?~~ **Résolu** : oui, dans une page dédiée « Infos pratiques » (transports, parking, plan intérieur). | — |
| ~~QO-044~~ | ~~Ordre de l'équipe ?~~ **Résolu** : ordre alphabétique (pas de randomisation). | — |
| ~~QO-045~~ | ~~Galerie photos ?~~ **Résolu** : mini galerie avec miniatures + lien vers les albums Google Photos complets. | — |
