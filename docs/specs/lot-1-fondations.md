# Lot 1 — Fondations & Billetterie

**Échéance** : 08 avril 2026
**Objectif** : le nouveau site remplace l'ancien. Le Blind Bird peut être annoncé, le CFP est mis en avant.

---

## Table des matières

1. [Règles de gestion](#règles-de-gestion)
2. [User stories — Fondations techniques](#user-stories--fondations-techniques)
3. [User stories — Header & Footer](#user-stories--header--footer)
4. [User stories — Page d'accueil](#user-stories--page-daccueil)
5. [User stories — Blog / Actualités](#user-stories--blog--actualités)
6. [User stories — Billetterie](#user-stories--billetterie)
7. [User stories — CFP](#user-stories--cfp)
8. [User stories — Contact](#user-stories--contact)
9. [User stories — Pages de contenu](#user-stories--pages-de-contenu)
10. [User stories — Page 404](#user-stories--page-404)
11. [User stories — Admin](#user-stories--admin)
12. [Parcours utilisateur](#parcours-utilisateur)
13. [Cas limites et erreurs](#cas-limites-et-erreurs)
14. [Questions ouvertes](#questions-ouvertes)

---

## Règles de gestion

### Rendu et cache

| # | Règle |
|---|-------|
| RG-001 | Toutes les pages publiques sont rendues côté serveur (SSR) avec hydratation client pour l'interactivité. |
| RG-002 | Les pages HTML publiques sont servies avec le header `Cache-Control: s-maxage=3600, stale-while-revalidate=60`. |
| RG-003 | La page d'accueil a un TTL réduit : `Cache-Control: s-maxage=300, stale-while-revalidate=60`. |
| RG-004 | Les assets statiques (images, CSS, JS) utilisent un hash dans le nom de fichier pour le cache busting et sont servis avec un cache longue durée (`max-age=31536000, immutable`). |
| RG-005 | La compression Brotli est activée en priorité, avec fallback sur Gzip. |

### SEO

| # | Règle |
|---|-------|
| RG-010 | Chaque page a une balise `<title>` unique au format : `{Nom de la page} — DevFest Toulouse 2026`. |
| RG-011 | Chaque page a une `<meta name="description">` unique de moins de 160 caractères. |
| RG-012 | Chaque page a une balise `<link rel="canonical">` pointant vers l'URL canonique de la page. |
| RG-013 | Un sitemap XML est généré automatiquement et inclut toutes les pages publiques (FR et EN). |
| RG-014 | Un fichier `robots.txt` est présent à la racine, référençant le sitemap. |
| RG-015 | Chaque page a les balises Open Graph : `og:title`, `og:description`, `og:image`, `og:url`, `og:type`. |
| RG-016 | Chaque page a les balises Twitter Card : `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`. |
| RG-017 | La page d'accueil inclut les données structurées Schema.org `Event` avec : `name`, `startDate`, `endDate`, `location`, `eventStatus`, `eventAttendanceMode`, `organizer`, `offers`. |
| RG-018 | Toutes les images ont un attribut `alt` descriptif. |
| RG-019 | Un fil d'Ariane (breadcrumb) avec balisage structuré Schema.org `BreadcrumbList` est présent sur toutes les pages sauf l'accueil. |
| RG-020 | Les images OG ont des dimensions minimales de 1200x630px. |

### Internationalisation (i18n)

| # | Règle |
|---|-------|
| RG-030 | Le site est nativement bilingue : français (langue par défaut) et anglais. |
| RG-031 | Toutes les URLs sont préfixées par la langue : `/fr/...` et `/en/...`. |
| RG-032 | L'URL racine `/` redirige vers `/fr/` (302). |
| RG-033 | L'attribut `lang` sur `<html>` correspond à la langue de la page (`fr` ou `en`). |
| RG-034 | Les textes de l'interface (navigation, boutons, labels) sont externalisés dans des fichiers de traduction. |
| RG-035 | Chaque page a des balises `<link rel="alternate" hreflang="fr">` et `<link rel="alternate" hreflang="en">` pointant vers les versions dans les deux langues. |
| RG-036 | La détection de la langue du navigateur est utilisée pour suggérer un changement de langue (bannière non bloquante), sans redirection automatique. |
| RG-037 | Un sélecteur de langue est accessible depuis toutes les pages (dans le header ou à proximité). |

### Accessibilité

| # | Règle |
|---|-------|
| RG-040 | Le site est conforme WCAG 2.1 niveau AA. |
| RG-041 | Un lien « Skip to content » est présent en premier élément focusable sur toutes les pages. |
| RG-042 | Toute la navigation est utilisable au clavier (Tab, Shift+Tab, Enter, Escape). |
| RG-043 | Les contrastes de couleur respectent un ratio minimum de 4.5:1 pour le texte courant et 3:1 pour le texte de grande taille. |
| RG-044 | Les landmarks ARIA sont définis : `<header>`, `<nav>`, `<main>`, `<footer>`. |
| RG-045 | Les formulaires ont des labels associés à chaque champ via `for`/`id` ou `aria-label`. |
| RG-046 | Les messages d'erreur des formulaires utilisent `aria-describedby` et `aria-invalid`. |
| RG-047 | Les états de focus sont visibles et non supprimés par le CSS. |

### Performance

| # | Règle |
|---|-------|
| RG-050 | Lighthouse ≥ 90 sur les 4 catégories (Performance, Accessibility, Best Practices, SEO) sur toutes les pages publiques. |
| RG-051 | LCP (Largest Contentful Paint) < 2.5s. |
| RG-052 | INP (Interaction to Next Paint) < 200ms. |
| RG-053 | CLS (Cumulative Layout Shift) < 0.1. |
| RG-054 | Les images sont servies en WebP ou AVIF avec fallback, utilisent `srcset`/`sizes` pour le responsive, et `loading="lazy"` sauf pour les images above-the-fold. |
| RG-055 | Les polices Google Sans sont préchargées avec `<link rel="preload">` et utilisent `font-display: swap`. |
| RG-056 | Le CSS critique est inline, le reste est chargé de manière différée. |
| RG-057 | Le JavaScript est découpé par route (code splitting) avec tree-shaking. |

### Sécurité

| # | Règle |
|---|-------|
| RG-060 | Les headers de sécurité suivants sont définis sur toutes les réponses : `Content-Security-Policy`, `Strict-Transport-Security` (max-age ≥ 31536000), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. |
| RG-061 | Les secrets (clés API, tokens) ne sont jamais dans le code source ; ils sont gérés via des variables d'environnement. |

### Responsive

| # | Règle |
|---|-------|
| RG-070 | Le site est conçu mobile-first avec des breakpoints tablette et desktop. |
| RG-071 | Les breakpoints de référence sont : mobile < 768px, tablette 768-1024px, desktop > 1024px. (Les maquettes Figma sont en desktop 1440px ; le mobile et la tablette sont à concevoir par le développeur.) |

### Page d'accueil — Statut annuel

| # | Règle |
|---|-------|
| RG-080 | La page d'accueil affiche un contenu conditionnel selon le statut annuel de l'édition courante. |
| RG-081 | Les trois statuts possibles sont : « Édition en préparation », « Annonce de l'édition », « Rendez-vous l'année prochaine ». |
| RG-082 | En mode « Édition en préparation » : hero teasing, newsletter, réseaux sociaux, replay édition précédente. |
| RG-083 | En mode « Annonce de l'édition » : hero complet, chiffres clés, sponsors (si disponibles), billetterie (si active), speakers en vedette (si disponibles), dernières actualités, replay. |
| RG-084 | En mode « Rendez-vous l'année prochaine » : bilan, aftermovie, galerie photos, replays, lien éditions précédentes. |
| RG-085 | La bascule de statut par un admin déclenche une purge immédiate du cache de la page d'accueil. |
| RG-086 | Pour le Lot 1, seul le mode « Annonce de l'édition » est implémenté (les sections Speakers et Sponsors sont masquées tant que les données ne sont pas disponibles). |

### Blog / Actualités

| # | Règle |
|---|-------|
| RG-090 | Les articles de blog sont bilingues (titre, contenu, extrait en FR et EN). |
| RG-091 | Chaque article a un slug unique dérivé du titre, utilisé dans l'URL. |
| RG-092 | Les articles sont triés par date de publication décroissante (plus récent en premier). |
| RG-093 | Un article a obligatoirement : un titre, un contenu, une date de publication. L'image à la une et l'extrait sont facultatifs. |
| RG-094 | Si l'extrait n'est pas renseigné, il est généré automatiquement à partir des 200 premiers caractères du contenu (texte brut, sans HTML). |
| RG-095 | Les articles peuvent être associés à des étiquettes (tags) pour la classification. |
| RG-096 | Chaque édition du DevFest existe automatiquement comme étiquette. |
| RG-097 | L'image OG d'un article est son image à la une. Si absente, l'image OG par défaut du site est utilisée. |

### Billetterie

| # | Règle |
|---|-------|
| RG-100 | La billetterie affiche les paliers de prix dans l'ordre : Blind Bird, Early Bird, Normal. |
| RG-101 | Chaque palier a un nom, un prix en euros et un état (Disponible ou Épuisé). |
| RG-102 | Un palier épuisé (sold out) est affiché barré ou grisé avec la mention « Épuisé » / « Sold out ». |
| RG-103 | Chaque palier disponible comporte un lien vers la plateforme de billetterie externe (Billetweb ou autre). |
| RG-104 | La page de billetterie n'effectue aucune transaction : elle redirige vers la plateforme externe. |
| RG-105 | Les paliers non encore ouverts ne sont pas affichés, ou affichés avec la mention « Bientôt disponible ». |

### Formulaire de contact

| # | Règle |
|---|-------|
| RG-110 | Le formulaire de contact comprend les champs : prénom (obligatoire), nom (obligatoire), email (obligatoire, format email validé), téléphone (facultatif), objet (obligatoire, dropdown), message (obligatoire, min 10 caractères). |
| RG-111 | Les objets possibles dans le dropdown sont : « Partenariat », « Presse / Média », « Accessibilité », « Question générale », « Autre ». |
| RG-112 | Le formulaire est protégé contre le spam (CAPTCHA invisible ou honeypot). |
| RG-113 | Après soumission réussie, un message de confirmation est affiché sur la page (pas de redirection). |
| RG-114 | Les messages de contact sont envoyés par email à contact@devfesttoulouse.fr. |
| RG-115 | Les données du formulaire ne sont pas stockées en base de données (envoi email uniquement), conformément au RGPD. |
| RG-116 | L'encart latéral affiche : une note sur les délais de réponse (« Nous sommes bénévoles, merci pour votre patience ») et les liens vers les réseaux sociaux. |
| RG-117 | Les validations sont effectuées côté client (feedback immédiat) ET côté serveur (sécurité). |

### Pages de contenu (CoC, Mentions légales)

| # | Règle |
|---|-------|
| RG-120 | Les pages de contenu (Code de conduite, Mentions légales) sont bilingues (FR + EN). |
| RG-121 | Le Code de conduite est basé sur le Berlin Code of Conduct, adapté au DevFest Toulouse. |
| RG-122 | Les Mentions légales incluent : informations de l'association (nom, siège, SIRET), hébergeur du site, politique de données personnelles (RGPD), cookies. |

### Page 404

| # | Règle |
|---|-------|
| RG-130 | La page 404 affiche un message d'erreur personnalisé avec le branding DevFest Toulouse. |
| RG-131 | La page 404 propose un lien de retour vers la page d'accueil. |
| RG-132 | La page 404 respecte la langue de l'URL demandée (si `/en/...` → message en anglais). |

---

## User stories — Fondations techniques

### US-101 : Rendu SSR avec cache

**En tant que** visiteur,
**je veux** que les pages se chargent rapidement avec du contenu visible immédiatement,
**afin de** ne pas attendre un écran blanc pendant le chargement JavaScript.

**Critères d'acceptation :**
- [ ] Les pages HTML sont générées côté serveur et contiennent le contenu complet.
- [ ] Le header `Cache-Control` est présent sur toutes les réponses HTML publiques (RG-002, RG-003).
- [ ] Les assets statiques utilisent un hash dans le nom de fichier (RG-004).
- [ ] La compression Brotli/Gzip est active (RG-005).

### US-102 : SEO — Meta tags et données structurées

**En tant que** moteur de recherche,
**je veux** trouver des meta tags et données structurées sur chaque page,
**afin de** indexer et afficher correctement le site dans les résultats de recherche.

**Critères d'acceptation :**
- [ ] Chaque page a un `<title>` unique (RG-010) et une `<meta description>` (RG-011).
- [ ] Chaque page a une `<link rel="canonical">` (RG-012).
- [ ] Le sitemap XML est accessible à `/sitemap.xml` (RG-013).
- [ ] Le `robots.txt` est accessible à `/robots.txt` et référence le sitemap (RG-014).
- [ ] Les balises Open Graph et Twitter Card sont présentes (RG-015, RG-016).
- [ ] La page d'accueil contient les données structurées Schema.org `Event` (RG-017).
- [ ] Toutes les images ont un attribut `alt` (RG-018).
- [ ] Le breadcrumb est balisé en Schema.org `BreadcrumbList` (RG-019).

### US-103 : Site bilingue FR/EN

**En tant que** visiteur anglophone,
**je veux** naviguer sur le site en anglais,
**afin de** comprendre le contenu de l'événement.

**Critères d'acceptation :**
- [ ] Toutes les pages sont disponibles en `/fr/...` et `/en/...` (RG-031).
- [ ] L'URL racine `/` redirige vers `/fr/` (RG-032).
- [ ] L'attribut `lang` sur `<html>` est correct (RG-033).
- [ ] Les textes d'interface sont traduits (RG-034).
- [ ] Les balises `hreflang` pointent vers les deux versions (RG-035).
- [ ] Un sélecteur de langue est visible et fonctionnel sur toutes les pages (RG-037).
- [ ] La détection de langue du navigateur déclenche une suggestion (bannière) sans redirection forcée (RG-036).

### US-104 : Accessibilité WCAG 2.1 AA

**En tant que** utilisateur en situation de handicap,
**je veux** pouvoir naviguer et interagir avec le site au clavier et avec un lecteur d'écran,
**afin de** accéder aux informations du DevFest.

**Critères d'acceptation :**
- [ ] Le lien « Skip to content » est le premier élément focusable (RG-041).
- [ ] Toute la navigation fonctionne au clavier (RG-042).
- [ ] Les contrastes respectent les ratios WCAG (RG-043).
- [ ] Les landmarks ARIA sont présents (RG-044).
- [ ] Les tests axe-core ne remontent aucune erreur critique.

### US-105 : Responsive mobile-first

**En tant que** visiteur sur mobile,
**je veux** que le site s'adapte à la taille de mon écran,
**afin de** naviguer confortablement sur téléphone ou tablette.

**Critères d'acceptation :**
- [ ] Le site est lisible et utilisable sur mobile (< 768px), tablette (768-1024px) et desktop (> 1024px) (RG-070, RG-071).
- [ ] Le header se transforme en menu hamburger sur mobile.
- [ ] Les grilles (articles, sponsors) passent de 4 colonnes (desktop) à 2 (tablette) à 1 (mobile).
- [ ] Les images s'adaptent avec `srcset`/`sizes` (RG-054).

### US-106 : Headers de sécurité

**En tant que** visiteur,
**je veux** que le site soit protégé contre les attaques web courantes,
**afin de** naviguer en sécurité.

**Critères d'acceptation :**
- [ ] Tous les headers de sécurité listés en RG-060 sont présents sur chaque réponse.
- [ ] HSTS a un `max-age` ≥ 1 an.
- [ ] La CSP est restrictive et n'autorise pas `unsafe-inline` pour les scripts (sauf si nécessaire pour l'hydratation SSR, auquel cas un nonce est utilisé).

### US-107 : Performance Lighthouse

**En tant que** visiteur,
**je veux** que le site soit rapide et fluide,
**afin de** ne pas abandonner par frustration.

**Critères d'acceptation :**
- [ ] Lighthouse ≥ 90 sur les 4 catégories pour la page d'accueil (RG-050).
- [ ] LCP < 2.5s, INP < 200ms, CLS < 0.1 (RG-051, RG-052, RG-053).
- [ ] Les polices sont préchargées (RG-055).
- [ ] Le CSS critique est inline (RG-056).
- [ ] Le JS est découpé par route (RG-057).

---

## User stories — Header & Footer

### US-110 : Header

**En tant que** visiteur,
**je veux** voir un header clair avec la navigation principale et les actions clés,
**afin de** accéder rapidement aux pages du site.

**Critères d'acceptation :**
- [ ] Le header est fixe (sticky) en haut de page, hauteur 60px, fond blanc avec ombre.
- [ ] Logo DevFest Toulouse (version minimale/avatar 48px) à gauche, lien vers l'accueil.
- [ ] Navigation : Programme, Speakers, Partenaires, Actus — chaque lien mène à la page correspondante (en gris #777776, Google Sans Regular 16px).
- [ ] Réseaux sociaux : icônes LinkedIn, YouTube, X/Twitter, Bluesky (24px) — liens vers les profils officiels, ouverts dans un nouvel onglet.
- [ ] CTA secondaire « Devenir partenaire » (bouton outline bleu #507BBD).
- [ ] CTA principal « Proposer un talk » (bouton plein bleu #507BBD) — lien vers Sessionize.
- [ ] Sur mobile : le header se réduit à un logo + menu hamburger.
- [ ] Le sélecteur de langue FR/EN est accessible depuis le header.

### US-111 : Footer

**En tant que** visiteur,
**je veux** trouver des liens utiles et les réseaux sociaux en bas de page,
**afin de** accéder aux informations complémentaires.

**Critères d'acceptation :**
- [ ] Fond Malachite (#109E6E), radius 32px, ombre section.
- [ ] Logo DevFest Toulouse complet (333x150px) en haut à gauche.
- [ ] Texte « Suivez l'aventure en ligne : » suivi de 4 icônes réseaux sociaux (48px).
- [ ] CTA « Contactez nous » (bouton Small) menant à la page Contact.
- [ ] 3 colonnes de liens à droite :
  - Navigation : Programme, Speakers, Partenaires, Actus
  - Nos écosystèmes tech : ToulouseTechHub, CloudToulouse (liens externes)
  - Éditions précédentes : DevFest Toulouse 2025, 2024, 2023 (liens externes vers les anciens sites)
- [ ] Barre basse : fond blanc 75% opacité, texte « Sans bug depuis 2016 - DevFest Toulouse by GDG Toulouse », liens Mentions légales, Code de conduite, Plan du site.
- [ ] Sur mobile : les 3 colonnes passent en empilé vertical (une colonne).

---

## User stories — Page d'accueil

### US-120 : Section Hero

**En tant que** visiteur,
**je veux** comprendre immédiatement ce qu'est le DevFest Toulouse en arrivant sur le site,
**afin de** savoir si l'événement m'intéresse.

**Critères d'acceptation :**
- [ ] Image de fond avec coins arrondis (radius 64px), overlay sombre.
- [ ] Titre « DevFest » en Malachite (#109E6E) et « Toulouse » en Terre cuite (#EC6839), taille 112px.
- [ ] Sous-titre : « La conférence Toulousaine par les devs et pour les devs. » en 32px.
- [ ] Date de l'événement (ex. « 19 novembre 2026 »).
- [ ] Lieu (ex. « Diagora, Labège »).
- [ ] CTA « Devenir partenaire » (secondaire, outline).
- [ ] CTA « Proposer un talk » (principal, lien vers Sessionize).
- [ ] L'image hero est optimisée (WebP/AVIF, preload, pas de lazy loading car above-the-fold).

### US-121 : Section Chiffres clés

**En tant que** visiteur,
**je veux** voir les chiffres clés du DevFest Toulouse,
**afin de** mesurer l'ampleur de l'événement.

**Critères d'acceptation :**
- [ ] Encart blanc arrondi (radius 40px) avec ombre section.
- [ ] Titre : « La plus grande conférence tech du bassin Toulousain » avec « tech » en Malachite et « Toulousain » en Terre cuite.
- [ ] 4 blocs de statistiques avec icône Font Awesome + valeur en 64px Bold + label en 24px Regular :
  - Journée (fa-calendar-days)
  - Participants (fa-users)
  - Conférences (fa-microphone)
  - Stands (fa-handshake)
- [ ] Illustration La Grave à gauche.
- [ ] Les chiffres affichés sont ceux de l'édition précédente (2025) tant que ceux de 2026 ne sont pas disponibles.

### US-122 : Section À propos

**En tant que** visiteur,
**je veux** connaître l'organisation derrière le DevFest,
**afin de** comprendre la philosophie de l'événement.

**Critères d'acceptation :**
- [ ] Section « Derrière le #DevFestToulouse » avec image de fond et overlay.
- [ ] Bloc de texte sur fond blanc semi-transparent présentant le GDG Toulouse.
- [ ] Section « Plongez dans notre écosystème » avec CTAs vers ToulouseTechHub et CloudToulouse (liens externes, nouvel onglet).

### US-123 : Section Dernières actualités

**En tant que** visiteur,
**je veux** voir les dernières actualités du DevFest,
**afin de** me tenir informé.

**Critères d'acceptation :**
- [ ] Titre « Dernières actualités ».
- [ ] Lien « Lire plus d'articles » menant vers la page Actualités.
- [ ] Grille de 4 ArticleCards (les 4 articles les plus récents).
- [ ] Si moins de 4 articles existent, la grille s'adapte.
- [ ] Si aucun article n'existe, la section est masquée.

### US-124 : Section Replay / Aftermovie

**En tant que** visiteur,
**je veux** voir l'aftermovie de l'édition précédente,
**afin de** me donner envie de participer.

**Critères d'acceptation :**
- [ ] Vidéo YouTube intégrée (aftermovie de l'édition 2025).
- [ ] L'intégration YouTube utilise un chargement différé (façade légère ou lazy loading) pour ne pas pénaliser le LCP.
- [ ] Si aucun aftermovie n'est configuré, la section est masquée.

---

## User stories — Blog / Actualités

### US-130 : Page liste des actualités

**En tant que** visiteur,
**je veux** consulter la liste de toutes les actualités du DevFest,
**afin de** suivre les annonces.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Actualités.
- [ ] Grille de ArticleCards en 4 colonnes (desktop), 2 colonnes (tablette), 1 colonne (mobile).
- [ ] Chaque card affiche : thumbnail (280x210px), titre (24px Bold), auteur (12px Bold Bismarck), date (10px gris), lien « Lire ».
- [ ] Les articles sont triés par date décroissante (RG-092).
- [ ] Si plus de 12 articles, pagination ou scroll infini.
- [ ] La page a un `<title>` « Actualités — DevFest Toulouse 2026 » (RG-010).

### US-131 : Page détail d'un article

**En tant que** visiteur,
**je veux** lire un article en entier,
**afin de** obtenir les détails d'une actualité.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Actualités > {Titre de l'article}.
- [ ] Titre principal en H2 (64px Bold).
- [ ] Contenu riche : paragraphes, sous-titres (H4/H5), images, liens.
- [ ] Largeur de contenu 1152px (desktop).
- [ ] Le `<title>` est « {Titre de l'article} — DevFest Toulouse 2026 ».
- [ ] L'image OG est l'image à la une de l'article (RG-097).
- [ ] Un lien de retour vers la liste des actualités est visible.

---

## User stories — Billetterie

### US-140 : Page Billetterie

**En tant que** visiteur,
**je veux** voir les tarifs et la disponibilité des billets,
**afin de** savoir quand et comment acheter mon billet.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Billetterie.
- [ ] Affichage des paliers dans l'ordre : Blind Bird, Early Bird, Normal (RG-100).
- [ ] Chaque palier affiche : nom, prix en euros, état (RG-101).
- [ ] Les paliers épuisés sont visuellement distincts (grisés, barrés) avec mention « Épuisé » / « Sold out » (RG-102).
- [ ] Les paliers disponibles ont un CTA « Acheter » menant vers la plateforme externe (RG-103, RG-104).
- [ ] Les paliers non encore ouverts affichent « Bientôt disponible » (RG-105).
- [ ] La page est bilingue FR/EN.

---

## User stories — CFP

### US-150 : Page CFP (Call for Papers)

**En tant que** speaker potentiel,
**je veux** connaître les dates du CFP et accéder à la plateforme de soumission,
**afin de** proposer un talk au DevFest.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Proposer un talk.
- [ ] Dates d'ouverture et de fermeture du CFP clairement affichées.
- [ ] CTA principal « Proposer un talk » menant vers Sessionize (lien externe, nouvel onglet).
- [ ] Brève description du processus de sélection et des formats acceptés (conférence 40min, quickie 15min, keynote).
- [ ] La page est bilingue FR/EN.
- [ ] Lorsque le CFP est fermé, la page l'indique clairement (« Le CFP est fermé. Merci pour vos soumissions ! »).

---

## User stories — Contact

### US-160 : Formulaire de contact

**En tant que** visiteur,
**je veux** contacter l'organisation du DevFest,
**afin de** poser une question ou proposer un partenariat.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Contact.
- [ ] Layout deux colonnes (desktop) : formulaire à gauche (616px), encart latéral à droite (512px).
- [ ] Champs du formulaire (RG-110) :
  - Prénom + Nom côte à côte (292px chacun)
  - Email (pleine largeur)
  - Téléphone (pleine largeur, facultatif)
  - Objet (dropdown avec les valeurs de RG-111)
  - Message (textarea, pleine largeur, 400px de haut)
  - Bouton « Envoyer » (CTA centré)
- [ ] Validation côté client : champs obligatoires, format email, longueur min du message (RG-117).
- [ ] Messages d'erreur sous chaque champ invalide, avec `aria-describedby` et `aria-invalid` (RG-046).
- [ ] Protection anti-spam (RG-112).
- [ ] Après soumission réussie : message de confirmation affiché sur la page, formulaire réinitialisé (RG-113).
- [ ] Encart latéral : note sur les délais de réponse + réseaux sociaux (RG-116).
- [ ] Sur mobile : les deux colonnes passent en empilé vertical.
- [ ] Le formulaire est bilingue FR/EN (labels, messages d'erreur, placeholder, message de confirmation).

---

## User stories — Pages de contenu

### US-170 : Code de conduite

**En tant que** visiteur,
**je veux** lire le code de conduite de l'événement,
**afin de** connaître les règles de comportement attendues.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Code de conduite.
- [ ] Contenu riche avec titre principal H2, sous-sections, paragraphes.
- [ ] Largeur de contenu 1152px (desktop).
- [ ] Disponible en FR et EN (RG-120, RG-121).
- [ ] `<title>` : « Code de conduite — DevFest Toulouse 2026 ».

### US-171 : Mentions légales

**En tant que** visiteur,
**je veux** accéder aux mentions légales du site,
**afin de** connaître les informations légales de l'association et la politique RGPD.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Mentions légales.
- [ ] Contenu riche avec titre H2, sous-sections.
- [ ] Inclut : info association, hébergeur, politique RGPD, cookies (RG-122).
- [ ] Disponible en FR et EN (RG-120).

---

## User stories — Page 404

### US-180 : Page d'erreur 404

**En tant que** visiteur ayant atteint une URL inexistante,
**je veux** voir un message d'erreur clair et un moyen de revenir au site,
**afin de** ne pas être bloqué.

**Critères d'acceptation :**
- [ ] Message d'erreur personnalisé avec le branding DevFest Toulouse (RG-130).
- [ ] Lien « Retour à l'accueil » menant vers `/fr/` ou `/en/` selon la langue (RG-131, RG-132).
- [ ] Le header et le footer sont présents.
- [ ] La page ne renvoie pas de code 200 mais bien un HTTP 404.

---

## User stories — Admin

### US-190 : Gestion des articles (CRUD)

**En tant qu'** admin,
**je veux** créer, modifier et supprimer des articles de blog,
**afin de** publier des actualités sur le site.

**Critères d'acceptation :**
- [ ] Interface admin pour lister les articles existants.
- [ ] Formulaire de création/édition avec : titre (FR + EN), contenu riche (FR + EN), image à la une, extrait (FR + EN), étiquettes, date de publication.
- [ ] L'éditeur de contenu riche permet : titres, paragraphes, gras, italique, liens, images.
- [ ] Sauvegarde en brouillon possible (article non publié).
- [ ] Suppression avec confirmation.
- [ ] Après publication ou modification, le cache des pages impactées est purgé (page liste actualités, page détail article, section actualités de la page d'accueil).

### US-191 : Configuration du statut annuel

**En tant qu'** admin,
**je veux** changer le statut annuel de la page d'accueil,
**afin de** adapter le contenu affiché selon la phase de communication.

**Critères d'acceptation :**
- [ ] Interface admin avec un sélecteur proposant les 3 statuts (RG-081).
- [ ] Le statut actif est clairement indiqué.
- [ ] Le changement de statut déclenche une purge immédiate du cache de la page d'accueil (RG-085).
- [ ] Une confirmation est demandée avant le changement.

### US-192 : Gestion des paliers de billetterie

**En tant qu'** admin,
**je veux** gérer les paliers de billetterie (noms, prix, états, liens),
**afin de** mettre à jour la page billetterie au fil du temps.

**Critères d'acceptation :**
- [ ] Interface admin pour lister et modifier les paliers.
- [ ] Champs éditables : nom, prix, état (Disponible / Épuisé / Bientôt disponible), lien externe.
- [ ] Après modification, le cache de la page Billetterie est purgé.

### US-193 : Gestion du contenu CFP

**En tant qu'** admin,
**je veux** configurer les dates du CFP et l'état (ouvert/fermé),
**afin de** maintenir la page CFP à jour.

**Critères d'acceptation :**
- [ ] Interface admin pour définir : date d'ouverture, date de fermeture, lien Sessionize, état (ouvert/fermé).
- [ ] Après modification, le cache de la page CFP est purgé.

### US-194 : Gestion des pages de contenu statique

**En tant qu'** admin,
**je veux** modifier le contenu des pages statiques (Code de conduite, Mentions légales),
**afin de** maintenir ces pages à jour sans intervention développeur.

**Critères d'acceptation :**
- [ ] Éditeur de contenu riche bilingue (FR + EN) pour chaque page de contenu.
- [ ] Après modification, le cache de la page concernée est purgé.

---

## Parcours utilisateur

### Parcours 1 : Première visite — découverte du DevFest

1. Le visiteur arrive sur `devfesttoulouse.fr` → redirection vers `/fr/`.
2. Il voit le hero avec le titre, la date, le lieu et les CTAs.
3. Il scroll et découvre les chiffres clés de l'édition précédente.
4. Il continue de scroller et lit la section À propos.
5. Il voit les 4 dernières actualités et clique sur une card.
6. Il arrive sur la page détail de l'article, lit le contenu.
7. Il clique sur « Accueil » dans le breadcrumb pour revenir à l'accueil.
8. Il regarde l'aftermovie intégré.
9. Il clique sur « Proposer un talk » dans le header → redirigé vers Sessionize (nouvel onglet).

### Parcours 2 : Achat de billet Blind Bird

1. Le visiteur arrive sur la page d'accueil.
2. Il cherche la billetterie — soit via la navigation, soit en scrollant.
3. Il clique sur « Billetterie » dans la navigation.
4. Il arrive sur la page Billetterie et voit les paliers.
5. Le Blind Bird est disponible : il clique sur « Acheter ».
6. Il est redirigé vers la plateforme externe (nouvel onglet) pour finaliser l'achat.

### Parcours 3 : Visiteur anglophone

1. Le visiteur arrive sur `/fr/` (redirection depuis `/`).
2. Une bannière discrète lui suggère la version anglaise (détection de la langue du navigateur).
3. Il clique sur « Switch to English » dans la bannière ou sur le sélecteur de langue.
4. Il est redirigé vers `/en/` et voit le site en anglais.
5. Toute sa navigation reste en `/en/...`.

### Parcours 4 : Envoi d'un message de contact

1. Le visiteur clique sur « Contactez nous » dans le footer.
2. Il arrive sur la page Contact.
3. Il remplit le formulaire : prénom, nom, email, objet (« Partenariat »), message.
4. Il clique sur « Envoyer ».
5. Si des champs sont invalides → messages d'erreur affichés sous les champs.
6. Si tout est valide → message de confirmation affiché, formulaire réinitialisé.
7. L'équipe reçoit l'email à contact@devfesttoulouse.fr.

### Parcours 5 : Admin — publication d'un article

1. L'admin se connecte au back-office.
2. Il accède à la section « Articles ».
3. Il clique sur « Nouvel article ».
4. Il remplit le titre (FR + EN), l'extrait, le contenu riche, l'image à la une, les étiquettes.
5. Il peut sauvegarder en brouillon ou publier directement.
6. Il publie → le cache est purgé → l'article apparaît sur le site public.

### Parcours 6 : Admin — bascule du statut annuel

1. L'admin accède à la configuration du statut annuel.
2. Il voit le statut actuel (« Annonce de l'édition »).
3. Il sélectionne « Rendez-vous l'année prochaine ».
4. Une boîte de dialogue de confirmation s'affiche.
5. Il confirme → le statut change → le cache de la page d'accueil est purgé.
6. La page d'accueil publique affiche maintenant le mode bilan.

---

## Cas limites et erreurs

### Pages publiques

| Cas | Comportement attendu |
|-----|---------------------|
| Aucun article publié | La section « Dernières actualités » sur l'accueil est masquée. La page Actualités affiche un message « Aucune actualité pour le moment ». |
| Article sans image à la une | La card affiche un placeholder visuel (couleur unie avec le logo DevFest). L'image OG utilise l'image par défaut du site. |
| Article avec extrait vide | L'extrait est auto-généré depuis les 200 premiers caractères du contenu (RG-094). |
| URL d'article inexistante | Page 404 avec le branding DevFest. |
| Page demandée avec une langue non supportée (ex. `/de/...`) | Redirection 302 vers la version FR de la page. |
| Aftermovie non configuré | La section replay est masquée sur la page d'accueil. |
| Tous les paliers épuisés | La page Billetterie affiche tous les paliers barrés. Un message « Billetterie complète » est affiché. |
| Aucun palier configuré | La page Billetterie affiche un message « La billetterie n'est pas encore ouverte ». |
| CFP fermé | La page CFP indique « Le CFP est fermé » et le CTA est désactivé ou remplacé par un message. |

### Formulaire de contact

| Cas | Comportement attendu |
|-----|---------------------|
| Email au format invalide | Message d'erreur inline « Veuillez saisir une adresse email valide ». |
| Message trop court (< 10 car.) | Message d'erreur inline « Le message doit contenir au moins 10 caractères ». |
| Champs obligatoires vides | Message d'erreur inline « Ce champ est obligatoire ». |
| Erreur serveur à l'envoi | Message d'erreur « Une erreur est survenue. Veuillez réessayer ou nous contacter directement à contact@devfesttoulouse.fr ». |
| Soumission multiple rapide | Le bouton « Envoyer » est désactivé pendant le traitement (loading spinner). |
| Bot/spam | Le CAPTCHA invisible ou honeypot bloque la soumission sans message visible pour les humains. |

### SEO et cache

| Cas | Comportement attendu |
|-----|---------------------|
| Crawler sans support JavaScript | Le HTML SSR contient tout le contenu visible (pas de dépendance au JS pour le contenu). |
| Page en cache mais contenu modifié par l'admin | Le cache est purgé automatiquement après la modification admin. |
| Requête pendant la purge du cache | `stale-while-revalidate` sert l'ancien contenu pendant la régénération. |

### Admin

| Cas | Comportement attendu |
|-----|---------------------|
| Admin supprime le dernier article | La section actualités de l'accueil se masque automatiquement. |
| Admin laisse un champ obligatoire vide | Message d'erreur inline, sauvegarde bloquée. |
| Perte de connexion pendant l'édition | L'état du formulaire est préservé localement (auto-save ou warning avant fermeture). |

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| QO-001 | La navigation principale utilise-t-elle des liens simples ou des dropdowns (comme les « Agenda, À propos, Écosystème » du site 2023-2025) ? Le doc fonctionnalités mentionne « à arbitrer ». | Design header, implémentation navigation |
| QO-002 | Quelle plateforme de billetterie externe est utilisée (Billetweb, Eventbrite, autre) ? Le lien de redirection en dépend. | Page billetterie, données paliers |
| QO-003 | Le formulaire de contact doit-il stocker les messages en base de données en plus de l'envoi email, pour archivage ? | Architecture back-end, RGPD |
| QO-004 | Faut-il une pagination ou un scroll infini pour la liste des actualités ? Si pagination, combien d'articles par page ? | UX, performance |
| QO-005 | Le design system mentionne Google Sans comme police principale. Sa licence OFL est-elle confirmée pour un usage web commercial (même associatif) ? | Typographie, fallback |
| QO-006 | Quel service d'envoi d'email utiliser pour le formulaire de contact (SendGrid, Resend, SMTP direct, etc.) ? | Infrastructure, coût |
| QO-007 | Le plan du site (sitemap visuel pour les visiteurs, lien dans le footer) est-il une page à créer ou un simple lien vers le sitemap XML ? | Scope Lot 1 |
| QO-008 | La bannière de suggestion de langue doit-elle se souvenir du choix de l'utilisateur (cookie / localStorage) pour ne pas se réafficher ? | UX, RGPD (cookie) |
| QO-009 | Le back-office admin est-il un CMS headless existant (Strapi, Sanity, etc.) ou une interface custom ? | Architecture, effort de développement |
| QO-010 | Faut-il un mode « brouillon » avec prévisualisation pour les articles, ou un simple toggle publié/non publié ? | Complexité admin |
