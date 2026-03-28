# Priorisation du développement — DevFest Toulouse 2026

Lots de développement calés sur le rétroplanning de l'édition 2026.
Chaque lot doit être **en production** avant la date indiquée.

> Note : le site WordPress existant a été conservé pour l'annonce du 9 mars et l'ouverture du CFP. Le nouveau site prend le relais à partir du lot 1.

---

## Rétroplanning de référence

| Date | Jalon |
|------|-------|
| ~~09 mars~~ | ~~Annonce édition + ouverture CFP~~ *(couvert par l'ancien site)* |
| 08-09 avril | Plaquette sponsor + Blind Bird + réunion sponsors |
| Mai | Démarcher bénévoles, relances CFP |
| 31 mai | Clôture CFP |
| 18 juin | Dépouillement CFP |
| 19 juin | Annonce speakers + billetterie normale |
| Juillet | Draft planning journée |
| Août | Communication média/influenceurs |
| Septembre | Planning public + last bird + comm écoles + dossier sécurité + clôture stands |
| Octobre | Bénévoles finalisés + planning finalisé |
| 31 octobre | Derniers prints commandés |
| **19 novembre** | **Le DevFest** |

---

## Lot 1 — Fondations & Billetterie (prêt avant le 08 avril)

**Objectif** : le nouveau site remplace l'ancien. Le Blind Bird peut être annoncé, le CFP est mis en avant.

### Fondations techniques

- Mise en place technique : framework, déploiement, CI/CD
- Mise en place du design system (Google Sans, Font Awesome, tokens CSS)
- SSR + cache HTTP
- SEO de base (meta tags, OG, Schema.org Event)
- Accessibilité (skip to content, navigation clavier, contrastes)
- Responsive (mobile-first)
- i18n (structure bilingue FR/EN, URLs localisées)

### Pages publiques

- Header complet (logo, navigation, réseaux sociaux, CTAs « Devenir partenaire » + « Proposer un talk »)
- Footer complet (logo, réseaux, 3 colonnes, barre basse)
- Page d'accueil en mode **« Annonce de l'édition »** :
  - Hero (titre, date, lieu, CTAs)
  - Chiffres clés (édition précédente)
  - À propos / GDG Toulouse / écosystème
  - Dernières actualités (grille de 4 ArticleCards)
  - Replay / aftermovie édition précédente
- Page CFP (dates, lien Sessionize)
- Page Actualités (liste en grille de cards)
- Page de détail article (contenu riche)
- Page Billetterie (paliers, états sold-out, lien externe)
- Page Contact (formulaire + encart latéral)
- Pages de contenu : Code de conduite, Mentions légales
- Page 404

### Admin

- Gestion des articles (CRUD)
- Configuration du statut annuel de la page d'accueil

---

## Lot 2 — Speakers, Sessions & Sponsors (prêt avant le 19 juin)

**Objectif** : les speakers sélectionnés et les sponsors sont publiés simultanément.

### Fonctionnalités

- Page Speakers (liste avec photo, nom, entreprise)
- Page de détail speaker (bio, réseaux sociaux, sessions)
- Section « Speakers en vedette » sur la page d'accueil
- Page Partenaires : liste avec cartes par niveau (Platinum/Gold/autres)
- Page de détail sponsor (description, logo, liens sociaux)
- Section Partenaires sur la page d'accueil
- CTA « Devenir partenaire » actif (header + accueil + page partenaires)
- Admin : gestion des speakers (CRUD)
- Admin : gestion des sessions (CRUD)
- Admin : gestion des sponsors (CRUD)
- Admin : API de gestion des conférences
- Admin : API de gestion des sponsors
- Authentification (rôles admin, speaker, sponsor)
- Speaker connecté : édition de sa propre fiche
- Sponsor connecté : édition de sa propre fiche

### Souhaitable

- Publications réseaux sociaux (visuels speakers)

---

## Lot 3 — Programme (prêt avant septembre)

**Objectif** : le programme complet est publié avec la grille horaire.

### Fonctionnalités

- Page Programme / Schedule (grille horaire par salle)
- Sessions cliquables avec page de détail (titre, description, speaker, catégorie, niveau, langue, salle, créneau)
- Filtrage des sessions (niveau, format, langue, catégorie, recherche)
- Catégories colorées
- Export agenda (ICAL, PDF)

### Souhaitable

- Publications réseaux sociaux (visuels conférences)
- Billetterie : ajout du palier « Last Bird »

---

## Lot 4 — Contenu complémentaire (prêt avant octobre)

**Objectif** : toutes les pages publiques sont en place pour la communication finale.

### Fonctionnalités

- Page Lieu (description, adresse, carte Google Maps)
- Page Équipe (grille des organisateurs)
- Page FAQ
- Page À propos / Historique (frise chronologique, liens archives)
- Hall of replays (historique toutes éditions, liens YouTube)
- Galerie photos (lien Google Photos)

---

## Lot 5 — Jour J (prêt avant le 19 novembre)

**Objectif** : les fonctionnalités liées à l'événement en direct sont prêtes.

### Fonctionnalités

- Passport digital des stands (QR codes, scan, progression)
- Authentification participant
- Admin : bascule du statut annuel (« Annonce » → « Rendez-vous l'année prochaine » après l'événement)

### Souhaitable

- Publications réseaux sociaux (visuels sponsors)

---

## Après le DevFest

- Admin : bascule vers le statut « Rendez-vous l'année prochaine »
- Mise à jour de la page d'accueil : bilan, aftermovie, galerie photos
- Archivage de l'édition 2026
- Ajout des vidéos replay dans le Hall of replays

---

## Vue synthétique

| Lot | Échéance | Pages / Fonctionnalités clés |
|-----|----------|------------------------------|
| **Lot 1** | 08 avril | Fondations, Accueil, Blog, Billetterie, CFP, Contact, CoC, Mentions légales, 404 |
| **Lot 2** | 19 juin | Speakers, Sponsors, Sessions, Authentification, Espaces connectés |
| **Lot 3** | Septembre | Programme complet, Filtrage, Export agenda |
| **Lot 4** | Octobre | Lieu, Équipe, FAQ, Historique, Replays, Galerie |
| **Lot 5** | 19 novembre | Passport digital, Jour J |
