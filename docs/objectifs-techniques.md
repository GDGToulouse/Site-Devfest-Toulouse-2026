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
- Image OG dédiée par type de contenu :
  - Page d'accueil : visuel de l'édition
  - Speaker : photo du speaker + nom + DevFest branding
  - Session : titre + speaker + catégorie
  - Sponsor : logo du sponsor
  - Article : image à la une
- Dimensions d'image OG respectées (1200×630 px minimum)
- Génération dynamique ou pré-calculée des images OG

## Stratégie de rendu

### Page d'accueil — fichier statique pré-calculé
- Régénération à chaque modification de contenu (build statique déclenché par webhook ou action admin)
- Servie directement par le serveur web ou le CDN (temps de réponse < 100ms)
- Aucun appel API côté client au premier chargement

### Pages publiques non authentifiées — rendu côté serveur (SSR)
- Rendu HTML côté serveur pour un contenu indexable immédiatement par les moteurs de recherche
- Hydratation côté client pour l'interactivité (filtres, recherche, navigation dynamique)
- Pages concernées : speakers, sessions, programme, sponsors, blog, FAQ, à propos, lieu, code de conduite

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

- Structure prête pour le multilingue (FR par défaut, EN envisageable)
- Textes externalisés dans des fichiers de traduction
- Attribut `lang` correct sur le `<html>` et les blocs de contenu en langue différente

## Monitoring et observabilité

- Analytics : mesure des visites, pages vues, parcours utilisateur
- Suivi des Core Web Vitals en conditions réelles (RUM)
- Alertes sur les erreurs critiques (erreurs 5xx, temps de réponse dégradés)

## Outillage de développement

- Context7 MCP : consultation systématique de la documentation à jour des dépendances
- Linter et formatter configurés (exécution automatique en pre-commit)
- Tests automatisés dans la CI avant merge
- Audit Lighthouse automatisé dans la CI sur les pages clés
