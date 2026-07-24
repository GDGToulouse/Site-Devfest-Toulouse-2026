# Objectifs techniques — Site DevFest Toulouse 2026

---

## SEO

- Balises `<title>` et `<meta name="description">` uniques par page
- URLs propres et lisibles (`/speakers/nom-prenom`, `/sessions/titre-session`)
- Sitemap XML généré automatiquement
- Fichier `robots.txt` configuré
- Données structurées Schema.org : `Event`, `Organization`, `Person`, `Article`
- Balises `<link rel="canonical">` sur chaque page
- Fil d'Ariane (breadcrumb) avec balisage structuré
- Attributs `alt` sur toutes les images

## Open Graph Protocol & partage social

- Balises Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) sur toutes les pages
- Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- Balises événement : le DevFest étant un événement annuel récurrent, exploiter les propriétés Open Graph dédiées aux événements :
  - `og:type` = `website` sur les pages générales, `article` sur les articles de blog
  - Données structurées `Event` (Schema.org) enrichies : `startDate`, `endDate`, `location`, `eventStatus`, `eventAttendanceMode`, `organizer`, `offers` (billetterie)
  - Propriétés supplémentaires pour les événements récurrents : `previousStartDate` (éditions passées), `superEvent` (DevFest global)
- Image OG dédiée par type de contenu :
  - Page d'accueil : visuel de l'édition
  - Speaker : photo du speaker + nom + DevFest branding
  - Session : titre + speaker + catégorie
  - Sponsor : logo du sponsor
  - Article : image à la une
- Dimensions d'image OG respectées (1200×630 px minimum)
- Génération dynamique ou pré-calculée des images OG

## Stratégie de rendu

### Pages publiques (dont la page d'accueil) — SSR + cache

Toutes les pages publiques suivent la même stratégie de rendu : **rendu côté serveur (SSR) avec mise en cache HTTP**.

- Rendu HTML côté serveur pour un contenu indexable immédiatement par les moteurs de recherche
- Hydratation côté client pour l'interactivité (filtres, recherche, navigation dynamique)
- Pages concernées : **page d'accueil**, speakers, sessions, programme, sponsors, blog, FAQ, à propos, lieu, code de conduite

#### Politique de cache

- Pages HTML servies avec `Cache-Control: s-maxage=3600, stale-while-revalidate=60` (cache CDN 1h, avec revalidation transparente)
- La page d'accueil peut avoir un TTL plus court (ex. : `s-maxage=300`) pour refléter les mises à jour plus fréquemment
- Assets statiques (images, CSS, JS) : cache long avec hash dans le nom de fichier (cache busting)

#### Invalidation à la demande

Le cache est purgé de façon ciblée lorsque le contenu change, sans attendre l'expiration du TTL :

- **Changement de statut annuel** (bascule entre « Édition en préparation », « Annonce », « Rendez-vous l'année prochaine ») : purge de la page d'accueil
- **Modification de contenu** (speaker, sponsor, article, programme) : purge des pages impactées
- **Action manuelle admin** : bouton « Purger le cache » dans le back-office pour forcer la revalidation d'une page ou de l'ensemble du site
- Mécanisme : endpoint de revalidation interne appelé par le back-office ou par webhook, qui déclenche une purge CDN ciblée par URL

#### Contenu conditionnel de la page d'accueil

La page d'accueil affiche des sections différentes selon le statut annuel actif. Le statut est une donnée de configuration lue côté serveur au moment du rendu :

| Statut | Sections affichées |
|---|---|
| Édition en préparation | Hero teasing, newsletter, réseaux sociaux, replay édition précédente |
| Annonce de l'édition | Hero complet, chiffres clés, speakers en vedette, sponsors, billetterie, blog |
| Rendez-vous l'année prochaine | Bilan, aftermovie, galerie photos, replay, lien éditions précédentes |

La bascule de statut dans le back-office déclenche une purge immédiate du cache de la page d'accueil.

### Pages authentifiées — rendu hybride (SSR + SPA)
- Rendu serveur pour le squelette de page et le contenu initial
- Rendu client (SPA) pour les interactions riches : édition de fiche speaker/sponsor, tableau de bord admin
- Chargement différé des composants lourds (lazy loading)

## Performance web

### Objectifs Lighthouse
- **Performance** : score ≥ 90
- **Accessibility** : score ≥ 90
- **Best Practices** : score ≥ 90
- **SEO** : score ≥ 90

### Core Web Vitals
- **LCP** (Largest Contentful Paint) : < 2.5s
- **INP** (Interaction to Next Paint) : < 200ms
- **CLS** (Cumulative Layout Shift) : < 0.1

### Mesure automatisée en CI (#238)

Le workflow [`lighthouse.yml`](../.github/workflows/lighthouse.yml) audite les pages
clés (accueil, billetterie, speakers, article) sur les PR vers `dev` et `main`, et à la
demande (`workflow_dispatch`). Il démarre Postgres, l'API et le site avec les données de
`seed-dev.ts` — auditer des pages vides donnerait de bons scores sans signification.

Seuils dans [`src/frontend/lighthouserc.json`](../src/frontend/lighthouserc.json). Trois
écarts assumés entre ces objectifs et ce qui est **réellement mesurable en CI** :

| Point | Décision | Pourquoi |
|---|---|---|
| **INP** | Non asserté | N'existe pas en mode lab : c'est une métrique terrain. À suivre via le RUM en production (#118). |
| **Performance, LCP, CLS** | `warn`, pas `error` | Bruités sur runner GitHub partagé. Un rouge intermittent finirait ignoré, ce qui vaut moins qu'un avertissement lu. |
| **Score SEO agrégé** | Remplacé par des assertions par audit | En dehors de la production, [`robots.ts`](../src/frontend/src/app/robots.ts) sert `Disallow: /` (volontaire : ne pas indexer beta/local/CI). L'audit `is-crawlable` échoue donc toujours et pèse ~31 % du score SEO, le plafonnant à 0.69 sur une page parfaitement saine. Les autres audits SEO (`document-title`, `meta-description`, `canonical`, `hreflang`…) sont assertés individuellement en `error`. |

Accessibilité et bonnes pratiques restent en `error` à ≥ 90 : ces scores sont stables en
lab et méritent de bloquer une PR.

### Optimisation des ressources
- Images : formats modernes (WebP/AVIF) avec fallback, `srcset` et `sizes` pour le responsive, lazy loading natif (`loading="lazy"`)
- Fonts : préchargement des polices critiques (`<link rel="preload">`), `font-display: swap`
- CSS : extraction du CSS critique inline, chargement différé du reste
- JavaScript : tree-shaking, code splitting par route, chargement différé des scripts non critiques
- Compression : Brotli (prioritaire) ou Gzip sur toutes les réponses textuelles

### Cache et CDN
- Headers de cache HTTP appropriés (`Cache-Control`, `ETag`)
- Assets statiques avec hash dans le nom de fichier (cache busting)
- CDN pour les assets statiques et la page d'accueil pré-calculée

### Headers de sécurité et performance
- `Content-Security-Policy` restrictive
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` pour limiter les APIs navigateur non utilisées

## Accessibilité

- Conformité WCAG 2.1 niveau AA minimum
- Navigation clavier complète
- Lien "Skip to content" sur toutes les pages
- Contrastes de couleur suffisants (ratio ≥ 4.5:1 pour le texte)
- Attributs ARIA pertinents (landmarks, labels, live regions)
- Tests automatisés d'accessibilité dans la CI (axe-core ou équivalent)

## Internationalisation

- Site nativement bilingue : français (langue par défaut) et anglais
- Textes externalisés dans des fichiers de traduction
- URLs localisées avec préfixe de langue (`/fr/...`, `/en/...`)
- Attribut `lang` correct sur le `<html>` et les blocs de contenu en langue différente
- Détection de la langue du navigateur pour suggestion automatique (sans redirection forcée)

## Monitoring et observabilité

- Analytics : mesure des visites, pages vues, parcours utilisateur
- Suivi des Core Web Vitals en conditions réelles (RUM)
- Alertes sur les erreurs critiques (erreurs 5xx, temps de réponse dégradés)

## Outillage de développement

- Context7 MCP : consultation systématique de la documentation à jour des dépendances
- Linter et formatter configurés (exécution automatique en pre-commit)
- Tests automatisés dans la CI avant merge
- Audit Lighthouse automatisé dans la CI sur les pages clés
