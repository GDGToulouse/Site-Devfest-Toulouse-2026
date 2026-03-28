# Modèle de données métier — Site DevFest Toulouse 2026

Vision fonctionnelle des entités du site, de leurs informations et de leurs relations. Ce document décrit ce que l'utilisateur voit et manipule, indépendamment de l'implémentation technique.

---

## Vue d'ensemble des entités

```
Édition ──┬── Session ──── Speaker (1 à N)
          ├── Sponsor
          ├── Catégorie (tracks de l'édition)
          ├── Niveau de sponsoring (disponibles pour l'édition)
          ├── Créneau horaire
          └── Palier billetterie

Lieu ──── Salle (1 à N)
Édition ──── Lieu (réutilisable d'une année sur l'autre)

Speaker ──── Lien social (1 à N)
Sponsor ──┬── Lien social (1 à N)
          └── Speaker (employés du sponsor)

Membre d'équipe ──── Lien social (1 à N)

Article de blog ──── Étiquette (0 à N)

Page de contenu (FAQ, Code de conduite, À propos, Mentions légales)

Utilisateur ──── Rôle (admin, speaker, sponsor)
```

---

## Édition

Une édition représente une occurrence annuelle du DevFest Toulouse. Le site gère l'édition courante et conserve l'historique des éditions passées.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Année | Année de l'édition | 2026 |
| Date(s) | Date de début (et de fin si multi-jours) | 5 novembre 2026 |
| Lieu | Référence vers un lieu (réutilisable d'une édition à l'autre) | Centre de Congrès Diagora, Labège |
| Catégories | Tracks disponibles pour cette édition (liste de catégories) | IA/ML/Data, Cloud/Infra, UX/accessibilité… |
| Niveaux de sponsoring | Niveaux de partenariat proposés pour cette édition | Platinum, Gold, Silver |
| Statut annuel | Phase de communication de l'édition courante | « Annonce de l'édition » |
| Chiffres clés | Nombre de participants, sessions, tracks, durée | 1000 participants, 70 sessions, 4 tracks |
| Aftermovie | Lien vidéo de l'édition | URL YouTube |
| Galerie photos | Lien(s) vers les albums photos | URL Google Photos |
| Site archivé | URL du site de cette édition (pour les éditions passées) | https://2019.devfesttoulouse.fr/ |

### Statuts annuels de l'édition courante

Le statut conditionne le contenu affiché sur la page d'accueil :

| Statut | Signification |
|--------|---------------|
| Édition en préparation | Page minimale de teasing, newsletter, réseaux sociaux, replay de l'édition précédente |
| Annonce de l'édition | Informations publiées progressivement : date, lieu, CFP, speakers, programme, billetterie |
| Rendez-vous l'année prochaine | Bilan de l'édition passée, aftermovie, galerie photos, replays |

---

## Session

Une conférence, un quickie ou une keynote programmée dans le cadre d'une édition.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Titre | Titre de la session (FR + EN) | « Kotlin Multiplatform en production » |
| Description | Résumé de la session (FR + EN) | Texte libre |
| Speaker(s) | Un ou plusieurs speakers associés | Marie Dupont, Jean Martin |
| Format | Type de session | Conférence (40 min), Quickie (15 min), Keynote |
| Catégorie | Thématique de la session | Cloud/Infra, IA/ML/Data, UX/accessibilité… |
| Niveau | Public visé | Débutant, Intermédiaire, Confirmé |
| Langue | Langue dans laquelle la session est présentée | Français, Anglais |
| Salle | Salle dans laquelle la session a lieu | Salle Ampère |
| Créneau horaire | Heure de début et de fin | 14:00 – 14:40 |
| Vidéo replay | Lien vers l'enregistrement vidéo (après l'événement) | URL YouTube |
| Slides | Lien vers le support de présentation | URL externe |

### Catégories de sessions (tracks)

Chaque édition définit sa propre liste de catégories, qui constituent les « tracks » de l'événement. Une session appartient à une catégorie parmi celles de son édition. Exemple pour les éditions récentes :

- Applications mobiles
- Cloud/Infra/{Dev-Git-Sec}Ops
- Developer Experience
- IA/ML/Data
- Langages
- Low code/No code
- Méthodes & outils
- Tech créative
- UX/accessibilité

---

## Speaker (conférencier)

Personne intervenant dans une ou plusieurs sessions d'une édition.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom complet | Marie Dupont |
| Photo | Portrait du speaker | Image |
| Entreprise | Organisation ou employeur (lien vers le sponsor si celui-ci est partenaire) | Google |
| Ville | Localisation | Toulouse, France |
| Biographie | Présentation du speaker (FR + EN) | Texte libre |
| Liens sociaux | Profils sur les réseaux et sites | Twitter, GitHub, LinkedIn, site personnel |
| Sessions | Sessions associées à ce speaker | Liste de sessions |
| Mis en vedette | Affiché sur la page d'accueil | Oui / Non |

Un speaker peut éditer sa propre fiche (bio, photo, liens sociaux) via un espace dédié après authentification.

---

## Sponsor (partenaire)

Entreprise ou organisation soutenant le DevFest.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom du sponsor | OVHcloud |
| Logo | Logo de l'entreprise | Image |
| Niveau de sponsoring | Catégorie de partenariat | Platinum, Gold, Silver, Soutien, Communauté |
| Site web | URL du site du sponsor | https://ovhcloud.com |
| Description | Présentation du sponsor (FR + EN) | Texte libre |
| Liens sociaux | Profils sur les réseaux sociaux | Twitter, LinkedIn… |
| Speakers | Speakers travaillant pour ce sponsor (lien automatique via l'entreprise) | Marie Dupont, Jean Martin |

Un sponsor peut éditer sa propre fiche (description, logo, liens) via un espace dédié après authentification.

Sur la fiche d'un sponsor, les speakers qui travaillent pour cette entreprise sont affichés, permettant de valoriser la contribution technique du partenaire.

### Niveaux de sponsoring

Les niveaux possibles sont ordonnés par importance décroissante et déterminent la visibilité (taille du logo, position sur la page) :

1. Platinum
2. Gold
3. Silver
4. Soutien
5. Communauté

Tous les niveaux ne sont pas nécessairement proposés à chaque édition. Chaque édition définit les niveaux de sponsoring qu'elle ouvre aux partenaires.

---

## Lieu

Espace accueillant le DevFest. Un lieu est réutilisable d'une édition à l'autre : si le DevFest se tient au même endroit plusieurs années consécutives, le lieu et ses salles sont partagés.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom du lieu | Centre de Congrès Diagora |
| Description | Présentation du lieu (FR + EN) | Texte libre |
| Adresse | Adresse postale complète | Labège, France |
| Coordonnées | Latitude / longitude pour la carte | 43.5432, 1.5098 |
| Lien itinéraire | URL vers Google Maps ou équivalent | URL |
| Salles | Ensemble des salles disponibles dans ce lieu | Salle Ampère, Salle Pasteur… |

### Salle

Espace physique au sein d'un lieu, disponible pour accueillir des sessions.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom de la salle | Salle Ampère |
| Capacité | Nombre de places (optionnel) | 300 |
| Ordre d'affichage | Position dans la grille du programme | 1 |

Les salles sont définies au niveau du lieu. Lors de la programmation d'une édition, les sessions sont affectées aux salles du lieu choisi pour cette édition.

---

## Créneau horaire

Plage horaire dans la grille du programme.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Heure de début | Début du créneau | 14:00 |
| Heure de fin | Fin du créneau | 14:40 |
| Jour | Jour de l'événement (si multi-jours) | Jour 1 |

---

## Palier de billetterie

Tarif de participation au DevFest.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom du palier | Blind Bird |
| Prix | Montant en euros | 40 € |
| État | Disponibilité du palier | Disponible, Épuisé (sold out) |
| Lien | URL vers la plateforme de billetterie externe | URL Billetweb |

Paliers habituels : Blind Bird → Early Bird → Normal.

---

## Article de blog

Publication d'actualité liée au DevFest.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Titre | Titre de l'article (FR + EN) | « Le CFP est ouvert ! » |
| Contenu | Corps de l'article (FR + EN) | Texte riche |
| Image | Image à la une | Image |
| Date de publication | Date de mise en ligne | 15 mars 2026 |
| Extrait | Résumé court pour les listes | Texte court |
| Étiquettes | Tags de classification (0 à N) | DevFest 2026, CFP, Speakers |

### Étiquettes

Les étiquettes (tags) servent à classifier et relier les articles entre eux. Elles alimentent le SEO (meta keywords, URLs navigables par tag) et permettent aux visiteurs de parcourir les articles par thème.

Chaque édition du DevFest existe automatiquement comme étiquette (ex. « DevFest 2024 », « DevFest 2025 », « DevFest 2026 »), ce qui permet de lier un article à une édition spécifique. Un article peut cependant n'être rattaché à aucune édition (actualité générale, annonce transverse).

Les étiquettes sont libres : en plus des éditions, on peut créer des tags thématiques (« CFP », « Speakers », « Billetterie », « Retour d'expérience »…).

---

## Membre d'équipe

Organisateur du DevFest Toulouse.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom complet | Pierre Martin |
| Photo | Portrait | Image |
| Rôle | Fonction dans l'organisation | Responsable sponsors |
| Liens sociaux | Profils sur les réseaux | Twitter, LinkedIn, GitHub |

---

## Page de contenu

Pages statiques éditables dont le contenu est bilingue.

| Page | Contenu |
|------|---------|
| FAQ | Liste de questions/réponses (accès, formats, billetterie, remboursement) |
| Code de conduite | Règles de comportement lors de l'événement |
| À propos | Présentation du GDG Toulouse, frise chronologique des éditions |
| Mentions légales | Informations légales de l'association, politique RGPD |

---

## Utilisateur

Personne disposant d'un compte sur le site.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Nom | Nom complet | Marie Dupont |
| Email | Adresse email (identifiant) | marie@example.com |
| Rôle | Permissions sur le site | Admin, Speaker, Sponsor |

### Rôles et permissions

| Rôle | Peut faire |
|------|------------|
| Admin | Tout gérer : éditions, sessions, speakers, sponsors, articles, statut annuel, purge du cache |
| Speaker | Éditer sa propre fiche (bio, photo, liens sociaux) |
| Sponsor | Éditer sa propre fiche (description, logo, liens sociaux) |

---

## Message de contact

Soumission via le formulaire de contact.

| Information | Description |
|-------------|-------------|
| Nom | Nom de l'expéditeur |
| Email | Adresse email de l'expéditeur |
| Objet | Motif du message (choix dans une liste) |
| Message | Corps du message |

---

## Passport digital des stands

Parcours ludique pour les participants visitant les stands des sponsors.

| Information | Description |
|-------------|-------------|
| Stand | Référence vers un sponsor |
| QR code | Code unique par stand, scanné par le participant |
| Tampon | Validation de la visite d'un stand |
| Progression | Nombre de stands visités / nombre total de stands |

---

## Lien social

Profil sur un réseau social ou site web, associé à un speaker, un sponsor ou un membre d'équipe.

| Information | Description | Exemple |
|-------------|-------------|---------|
| Type | Réseau ou plateforme | Twitter, LinkedIn, GitHub, Bluesky, site web |
| URL | Adresse du profil | https://twitter.com/mariedupont |

---

## Relations entre entités

```
Édition ──── N:1 ──── Lieu (réutilisable entre éditions)
Édition ──── 1:N ──── Session
Édition ──── 1:N ──── Sponsor (via niveau de sponsoring)
Édition ──── 1:N ──── Catégorie (tracks de l'édition)
Édition ──── 1:N ──── Niveau de sponsoring (disponibles pour l'édition)
Édition ──── 1:N ──── Créneau horaire
Édition ──── 1:N ──── Palier billetterie
Édition ──── 1:N ──── Membre d'équipe

Lieu ─────── 1:N ──── Salle

Session ──── N:M ──── Speaker
Session ──── N:1 ──── Catégorie (parmi celles de l'édition)
Session ──── N:1 ──── Salle (parmi celles du lieu de l'édition)
Session ──── N:1 ──── Créneau horaire

Speaker ──── 1:N ──── Lien social
Speaker ──── N:1 ──── Sponsor (via l'entreprise, si le sponsor est partenaire)

Sponsor ──── 1:N ──── Lien social

Membre d'équipe ── 1:N ──── Lien social

Utilisateur ── 0:1 ──── Speaker (si rôle speaker)
Utilisateur ── 0:1 ──── Sponsor (si rôle sponsor)

Article de blog ── N:M ── Étiquette
Étiquette (inclut automatiquement une étiquette par édition)

Passport digital ── N:M ── Sponsor (stands visités par participant)
```

---

## Contenus bilingues

Les informations suivantes existent en français **et** en anglais :

- Titre et description des sessions
- Biographie des speakers
- Description des sponsors
- Articles de blog (titre, contenu, extrait)
- Pages de contenu (FAQ, Code de conduite, À propos, Mentions légales)
- Description du lieu

Les informations non traduites (noms propres, URLs, dates, images, logos) restent identiques dans les deux langues.
