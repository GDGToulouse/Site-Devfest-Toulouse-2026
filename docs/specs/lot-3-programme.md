# Lot 3 — Programme

**Échéance** : septembre 2026
**Objectif** : le programme complet est publié avec la grille horaire.

**Prérequis** : Lot 2 livré et en production (speakers, sessions, sponsors existants).

---

## Table des matières

1. [Règles de gestion](#règles-de-gestion)
2. [User stories — Grille du programme](#user-stories--grille-du-programme)
3. [User stories — Page détail session](#user-stories--page-détail-session)
4. [User stories — Filtrage et recherche](#user-stories--filtrage-et-recherche)
5. [User stories — Export agenda](#user-stories--export-agenda)
6. [User stories — Admin](#user-stories--admin)
7. [User stories — Souhaitables](#user-stories--souhaitables)
8. [Parcours utilisateur](#parcours-utilisateur)
9. [Cas limites et erreurs](#cas-limites-et-erreurs)
10. [Questions ouvertes](#questions-ouvertes)

---

## Règles de gestion

### Grille du programme

| # | Règle |
|---|-------|
| RG-300 | La grille du programme affiche les sessions organisées par créneau horaire (lignes) et par salle (colonnes). |
| RG-301 | Les créneaux horaires sont définis par l'admin : heure de début, heure de fin. Si l'événement est multi-jours, les créneaux sont regroupés par jour. |
| RG-302 | Les salles affichées sont celles du lieu de l'édition courante, ordonnées selon leur « ordre d'affichage ». |
| RG-303 | Chaque cellule de la grille correspond à une session assignée à un créneau et une salle. |
| RG-304 | Les keynotes occupent toute la largeur de la grille (toutes les salles fusionnées). |
| RG-305 | Les pauses (déjeuner, pause café) sont affichées comme des créneaux spéciaux occupant toute la largeur, sans lien cliquable. |
| RG-306 | Chaque session dans la grille affiche : titre, speaker(s), catégorie (couleur), format (durée). |
| RG-307 | Les catégories de sessions ont un code couleur qui est appliqué visuellement sur la grille (bordure ou fond coloré). |
| RG-308 | La hauteur d'une cellule est proportionnelle à la durée de la session (ex. : un quickie de 15 min est plus petit qu'une conférence de 40 min). |

### Filtrage

| # | Règle |
|---|-------|
| RG-310 | Les filtres disponibles sont : niveau (Débutant, Intermédiaire, Confirmé, Tous), format (Conférence, Quickie, Keynote), langue (FR, EN), catégorie (liste dynamique), recherche texte (titre et description). |
| RG-311 | Les filtres sont cumulatifs (ET logique entre les critères). |
| RG-312 | Le filtre « recherche texte » effectue une recherche insensible à la casse et aux accents sur le titre et la description des sessions. |
| RG-313 | Quand un filtre est actif, les sessions qui ne correspondent pas sont visuellement atténuées (opacité réduite) ou masquées dans la grille. |
| RG-314 | L'URL reflète les filtres actifs (query parameters) pour permettre le partage d'une vue filtrée. |
| RG-315 | Les filtres s'appliquent aussi à la page Conférences (liste en grille de cards, telle que maquettée). |

### Export agenda

| # | Règle |
|---|-------|
| RG-320 | L'export ICAL (.ics) génère un fichier contenant toutes les sessions (ou uniquement les sessions filtrées) avec : titre, description, date/heure de début et fin, salle (location). |
| RG-321 | L'export PDF génère un document lisible avec la grille horaire complète, imprimable en A4 paysage. |
| RG-322 | Les exports sont disponibles uniquement quand le programme est publié (créneaux et salles assignés). |

### Page détail session

| # | Règle |
|---|-------|
| RG-330 | La page de détail d'une session affiche : titre, description, speaker(s) (photo + nom, cliquables), format, catégorie (avec couleur), niveau, langue, salle, créneau horaire. |
| RG-331 | Si la session a une vidéo replay (YouTube), elle est intégrée en bas de page. |
| RG-332 | Si la session a des slides, un lien est affiché. |
| RG-333 | Les données structurées Schema.org sont générées pour chaque session en tant que sous-événement de l'Event principal. |

---

## User stories — Grille du programme

### US-300 : Affichage de la grille horaire

**En tant que** visiteur,
**je veux** voir le programme complet sous forme de grille horaire,
**afin de** planifier ma journée au DevFest.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Programme.
- [ ] Grille avec les salles en colonnes et les créneaux horaires en lignes (RG-300).
- [ ] Les salles sont ordonnées selon l'ordre d'affichage défini (RG-302).
- [ ] Chaque cellule affiche le titre de la session, le(s) speaker(s), la catégorie (couleur), le format et la durée (RG-306).
- [ ] Les keynotes occupent toute la largeur (RG-304).
- [ ] Les pauses (déjeuner, café) sont affichées sur toute la largeur (RG-305).
- [ ] La hauteur des cellules est proportionnelle à la durée (RG-308).
- [ ] Clic sur une session → page de détail de la session.
- [ ] Sur mobile : la grille se transforme en liste verticale groupée par créneau horaire, avec un sélecteur de salle (onglets ou filtre).
- [ ] `<title>` : « Programme — DevFest Toulouse 2026 ».

### US-301 : Page Conférences (liste en grille)

**En tant que** visiteur,
**je veux** voir la liste de toutes les conférences sous forme de grille de cards,
**afin de** parcourir les sessions par thématique.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Programme > Conférences.
- [ ] Grille de session cards (4 colonnes desktop, 2 tablette, 1 mobile).
- [ ] Chaque card affiche : titre, speaker(s), catégorie (couleur), format, niveau.
- [ ] Clic sur une card → page de détail de la session.
- [ ] Les filtres sont disponibles (cf. US-310).

---

## User stories — Page détail session

### US-305 : Détail d'une session

**En tant que** visiteur,
**je veux** voir les détails complets d'une session,
**afin de** décider si je veux y assister.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Programme > Conférences > {Titre de la session}.
- [ ] Titre de la session (H2, dans la langue de la page).
- [ ] Speaker(s) : photo + nom + entreprise, cliquables vers la page de détail speaker.
- [ ] Description complète (dans la langue de la page).
- [ ] Métadonnées : format (Conférence / Quickie / Keynote), catégorie (avec couleur), niveau, langue de la session, salle, créneau horaire (heure début — heure fin).
- [ ] Si vidéo replay disponible : player YouTube intégré (RG-331).
- [ ] Si slides disponibles : lien « Voir les slides » (RG-332).
- [ ] `<title>` : « {Titre de la session} — DevFest Toulouse 2026 ».
- [ ] Image OG générée (RG-215).
- [ ] Données structurées Schema.org (RG-333).

---

## User stories — Filtrage et recherche

### US-310 : Filtrage des sessions

**En tant que** visiteur,
**je veux** filtrer les sessions par critère,
**afin de** trouver les conférences qui m'intéressent.

**Critères d'acceptation :**
- [ ] Zone de filtres visible au-dessus de la grille/liste (RG-310).
- [ ] Filtres par :
  - Niveau : Tous (défaut), Débutant, Intermédiaire, Confirmé
  - Format : Tous (défaut), Conférence, Quickie, Keynote
  - Langue : Toutes (défaut), Français, Anglais
  - Catégorie : Toutes (défaut), puis une entrée par catégorie de l'édition (avec pastille de couleur)
  - Recherche texte : champ de saisie libre
- [ ] Les filtres sont cumulatifs (RG-311).
- [ ] La recherche texte est insensible à la casse et aux accents (RG-312).
- [ ] Les sessions non correspondantes sont visuellement atténuées ou masquées (RG-313).
- [ ] L'URL est mise à jour avec les filtres actifs (ex. `?level=beginner&category=cloud`) (RG-314).
- [ ] Un bouton « Réinitialiser les filtres » est disponible.
- [ ] Les compteurs de résultats sont mis à jour en temps réel (ex. « 12 sessions trouvées »).

---

## User stories — Export agenda

### US-320 : Export ICAL

**En tant que** visiteur,
**je veux** exporter le programme au format ICAL,
**afin de** l'ajouter à mon calendrier personnel.

**Critères d'acceptation :**
- [ ] Bouton « Exporter en ICAL » visible sur la page Programme.
- [ ] Le fichier .ics généré contient toutes les sessions (ou les sessions filtrées si des filtres sont actifs).
- [ ] Chaque événement du .ics contient : titre, description, date/heure début, date/heure fin, lieu (salle).
- [ ] Le fichier est téléchargeable et ouvrable dans les calendriers courants (Google Calendar, Outlook, Apple Calendar).
- [ ] Si le programme n'est pas encore publié (pas de créneaux assignés), le bouton est masqué (RG-322).

### US-321 : Export PDF

**En tant que** visiteur,
**je veux** télécharger le programme en PDF,
**afin de** l'imprimer et l'emporter le jour J.

**Critères d'acceptation :**
- [ ] Bouton « Télécharger le PDF » visible sur la page Programme.
- [ ] Le PDF contient la grille horaire complète, lisible en A4 paysage.
- [ ] Les catégories sont colorées.
- [ ] Le branding DevFest est présent (logo, date, lieu).
- [ ] Si le programme n'est pas publié, le bouton est masqué (RG-322).

---

## User stories — Admin

### US-340 : Assignation des sessions aux créneaux et salles

**En tant qu'** admin,
**je veux** assigner les sessions aux créneaux horaires et aux salles,
**afin de** constituer le programme.

**Critères d'acceptation :**
- [ ] Interface de planification : vue grille (salles x créneaux) avec drag-and-drop des sessions.
- [ ] Les sessions non assignées sont listées dans un panneau latéral.
- [ ] Validation : pas deux sessions dans la même salle au même créneau.
- [ ] Validation : un speaker ne peut pas avoir deux sessions au même créneau.
- [ ] Possibilité de créer des créneaux « pause » (déjeuner, café, accueil) non liés à une session.
- [ ] Après publication, purge du cache de la page Programme.

### US-341 : Gestion des créneaux horaires

**En tant qu'** admin,
**je veux** définir les créneaux horaires de la journée,
**afin de** structurer le planning.

**Critères d'acceptation :**
- [ ] Création d'un créneau : heure de début, heure de fin, jour (si multi-jours), type (session ou pause).
- [ ] Modification et suppression de créneaux.
- [ ] Validation : pas de chevauchement de créneaux.
- [ ] Les créneaux sont ordonnés chronologiquement.

### US-342 : Publication du programme

**En tant qu'** admin,
**je veux** contrôler la publication du programme,
**afin de** ne pas le rendre public avant qu'il soit finalisé.

**Critères d'acceptation :**
- [ ] Toggle « Programme publié / non publié ».
- [ ] Tant que non publié, la page Programme affiche un message « Le programme sera bientôt disponible ».
- [ ] Les exports ICAL et PDF ne sont disponibles que si le programme est publié (RG-322).
- [ ] La publication déclenche une purge du cache.

---

## User stories — Souhaitables

### US-350 : Visuels réseaux sociaux pour les conférences

**En tant qu'** admin,
**je veux** générer des visuels de promotion pour chaque session,
**afin de** communiquer sur les réseaux sociaux.

**Critères d'acceptation :**
- [ ] Bouton « Générer le visuel » sur la fiche admin d'une session.
- [ ] Le visuel inclut : titre, speaker(s), catégorie, branding DevFest.
- [ ] Export PNG 1200x630px.
- [ ] Possibilité de génération en lot.

### US-351 : Palier « Last Bird »

**En tant qu'** admin,
**je veux** ajouter un palier « Last Bird » à la billetterie,
**afin de** proposer une dernière vague de billets avant l'événement.

**Critères d'acceptation :**
- [ ] Le palier est ajouté via l'interface existante de gestion des paliers (US-192).
- [ ] L'ordre d'affichage est : Blind Bird, Early Bird, Normal, Last Bird.
- [ ] Le palier a les mêmes propriétés (nom, prix, état, lien) que les autres.

---

## Parcours utilisateur

### Parcours 1 : Consultation du programme

1. Le visiteur clique sur « Programme » dans la navigation.
2. Il arrive sur la grille horaire.
3. Il voit les salles en colonnes et les créneaux en lignes.
4. Il repère une session colorée en bleu (catégorie Cloud) à 14h.
5. Il clique sur la session → page de détail.
6. Il lit la description, voit le speaker et les métadonnées.
7. Il revient à la grille via le breadcrumb.

### Parcours 2 : Filtrage et export

1. Le visiteur arrive sur la page Programme.
2. Il active le filtre « Niveau : Débutant ».
3. Les sessions non débutantes sont atténuées.
4. Il ajoute le filtre « Catégorie : IA/ML/Data ».
5. Il ne voit que les sessions IA/ML/Data de niveau Débutant (3 sessions).
6. Il clique sur « Exporter en ICAL » → téléchargement du .ics avec ces 3 sessions.
7. Il importe le fichier dans Google Calendar → les 3 sessions apparaissent.

### Parcours 3 : Consultation mobile

1. Le visiteur ouvre le site sur son téléphone.
2. Il clique sur « Programme ».
3. Au lieu d'une grille multi-colonnes, il voit une liste verticale.
4. Des onglets en haut lui permettent de filtrer par salle.
5. Il clique sur « Salle Ampère » → il ne voit que les sessions de cette salle.
6. Il clique sur une session → page de détail.

### Parcours 4 : Admin planifie le programme

1. L'admin accède à la section « Programme » du back-office.
2. Il définit les créneaux horaires de la journée (9h-10h keynote, 10h15-10h55 session, ...).
3. Il ouvre la vue de planification (grille drag-and-drop).
4. Il glisse les sessions depuis le panneau latéral vers les cellules.
5. Le système avertit si un speaker a un conflit horaire.
6. Il crée un créneau « Pause déjeuner » 12h30-14h.
7. Il vérifie le résultat et clique sur « Publier le programme ».
8. Le programme est visible publiquement.

---

## Cas limites et erreurs

### Grille du programme

| Cas | Comportement attendu |
|-----|---------------------|
| Session sans salle ni créneau assigné | La session n'apparaît pas dans la grille mais reste visible dans la liste Conférences. |
| Deux sessions dans la même salle au même créneau | Erreur admin : « Conflit : cette salle est déjà occupée sur ce créneau ». |
| Speaker avec deux sessions au même créneau | Avertissement admin : « Attention : {Nom} a déjà une session à ce créneau ». |
| Programme non publié | La page Programme affiche « Le programme sera bientôt disponible ». Les liens « Programme » dans la navigation restent visibles mais mènent vers ce message. |
| Créneau sans session (trou dans la grille) | La cellule reste vide (pas d'erreur). |
| Salle supprimée alors que des sessions y sont assignées | Les sessions orphelines perdent leur assignation de salle. L'admin est averti. |

### Filtrage

| Cas | Comportement attendu |
|-----|---------------------|
| Aucune session ne correspond aux filtres | Message « Aucune session ne correspond à vos critères » + bouton « Réinitialiser ». |
| Recherche texte avec caractères spéciaux | Les caractères spéciaux sont échappés pour éviter les injections. |
| Filtres dans l'URL avec des valeurs invalides | Les filtres invalides sont ignorés, les valides sont appliqués. |

### Export

| Cas | Comportement attendu |
|-----|---------------------|
| Export ICAL sans créneaux assignés | Le bouton est masqué (RG-322). |
| Export avec filtres actifs | Seules les sessions correspondant aux filtres sont incluses dans l'export. |
| Session sans heure de fin | L'heure de fin est calculée automatiquement (début + durée du format : 40 min conférence, 15 min quickie). |

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| QO-030 | La grille du programme est-elle une maquette non encore créée (cf. maquettes-figma.md). Quel design adopter ? S'inspirer des éditions passées (Hoverboard) ou design custom ? | Design, effort |
| QO-031 | Le filtrage des sessions doit-il fonctionner côté client (JS, filtrage instantané) ou côté serveur (rechargement) ? Pour les 70+ sessions attendues, le côté client semble plus performant. | Architecture, UX |
| QO-032 | L'export ICAL doit-il inclure un lien vers la page de détail de la session dans la description de l'événement ? | Contenu de l'export |
| QO-033 | Le PDF est-il généré côté serveur (librairie type Puppeteer, jsPDF) ou côté client (impression CSS @media print) ? | Architecture, dépendances |
| QO-034 | L'événement 2026 est-il confirmé sur un seul jour ? Si multi-jours, la grille doit-elle gérer des onglets par jour ? | Complexité grille |
| QO-035 | Les sessions « Office Hours » (Q&A informel avec les speakers, présent en 2018-2019) sont-elles prévues pour 2026 ? Si oui, comment les intégrer dans la grille ? | Format de session, design grille |
