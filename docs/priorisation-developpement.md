# Priorisation du développement — DevFest Toulouse 2026

Lots de développement calés sur le rétroplanning de l'édition 2026.
Chaque lot doit être **en production** avant la date indiquée.

---

## Rétroplanning de référence

| Date | Jalon |
|------|-------|
| 09 mars | Annonce édition + ouverture CFP |
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

## Lot 0 — Fondations (prêt avant le 09 mars)

**Objectif** : le site existe, est déployé, et affiche la page d'annonce.

### Fonctionnalités

- Mise en place technique : framework, déploiement, CI/CD
- Header complet (logo, navigation, réseaux sociaux, CTA « Proposer un talk » → Sessionize)
- Footer complet (logo, réseaux, 3 colonnes, barre basse)
- Page d'accueil en mode **« Annonce de l'édition »** :
  - Hero (titre, date, lieu, CTAs)
  - Chiffres clés (édition précédente)
  - À propos / GDG Toulouse / écosystème
  - Replay / aftermovie édition précédente
- Pages de contenu : Code de conduite, Mentions légales
- Page 404
- Page Contact (formulaire)
- SEO de base (meta tags, OG, Schema.org Event)
- Accessibilité (skip to content, navigation clavier, contrastes)
- Responsive (mobile-first)
- i18n (structure bilingue FR/EN, URLs localisées)

### Transverse

- Mise en place du design system (Google Sans, Font Awesome, tokens CSS)
- SSR + cache HTTP
- Déploiement continu

---

## Lot 1 — Sponsors & CFP (prêt avant le 08 avril)

**Objectif** : les sponsors sont visibles, le CTA « Devenir partenaire » fonctionne, le CFP est mis en avant.

### Fonctionnalités

- Page Partenaires : liste avec cartes par niveau (Platinum/Gold/autres)
- Page de détail sponsor (description, logo, liens sociaux)
- Section Partenaires sur la page d'accueil
- CTA « Devenir partenaire » actif (header + accueil + page partenaires)
- Page CFP (dates, lien Sessionize)
- Admin : gestion des sponsors (CRUD)
- Admin : API de gestion des sponsors

### Souhaitable

- Sponsor connecté : édition de sa propre fiche
- Blog / Actualités (pour publier l'annonce d'ouverture du CFP)

---

## Lot 2 — Blog & Billetterie (prêt avant le 09 avril)

**Objectif** : le Blind Bird peut être annoncé via le blog, avec lien billetterie.

### Fonctionnalités

- Page Actualités (liste en grille de cards)
- Page de détail article (contenu riche)
- Section « Dernières actualités » sur la page d'accueil
- Page Billetterie (paliers, états sold-out, lien externe)
- Admin : gestion des articles (CRUD)

---

## Lot 3 — Speakers & Sessions (prêt avant le 19 juin)

**Objectif** : les speakers sélectionnés sont publiés, leurs fiches sont en ligne.

### Fonctionnalités

- Page Speakers (liste avec photo, nom, entreprise)
- Page de détail speaker (bio, réseaux sociaux, sessions)
- Section « Speakers en vedette » sur la page d'accueil
- Admin : gestion des speakers (CRUD)
- Admin : gestion des sessions (CRUD)
- Admin : API de gestion des conférences
- Speaker connecté : édition de sa propre fiche
- Authentification (rôles admin, speaker, sponsor)

### Souhaitable

- Publications réseaux sociaux (visuels speakers)

---

## Lot 4 — Programme (prêt avant septembre)

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

## Lot 5 — Contenu complémentaire (prêt avant octobre)

**Objectif** : toutes les pages publiques sont en place pour la communication finale.

### Fonctionnalités

- Page Lieu (description, adresse, carte Google Maps)
- Page Équipe (grille des organisateurs)
- Page FAQ
- Page À propos / Historique (frise chronologique, liens archives)
- Hall of replays (historique toutes éditions, liens YouTube)
- Galerie photos (lien Google Photos)

---

## Lot 6 — Jour J (prêt avant le 19 novembre)

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
| **Lot 0** | 09 mars | Accueil (annonce), Contact, CoC, Mentions légales, 404, Header, Footer |
| **Lot 1** | 08 avril | Partenaires, CFP, Admin sponsors |
| **Lot 2** | 09 avril | Blog, Billetterie (Blind Bird) |
| **Lot 3** | 19 juin | Speakers, Sessions, Authentification |
| **Lot 4** | Septembre | Programme complet, Filtrage, Export agenda |
| **Lot 5** | Octobre | Lieu, Équipe, FAQ, Historique, Replays, Galerie |
| **Lot 6** | 19 novembre | Passport digital, Jour J |
