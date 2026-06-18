# Carrousel « Derrière le DevFest Toulouse »

Photos d'ambiance affichées dans le bloc « Derrière le DevFest Toulouse » de la
page d'accueil (issue #59), uniquement pendant la phase **annonce**.

## Ajouter des photos

1. Déposez vos images dans ce dossier (`public/images/about-carousel/`).
   - Format conseillé : JPG/WebP, ratio **16:10**, ~1200×750 px, optimisées.
2. Listez-les dans `CAROUSEL_SLIDES` de
   `src/components/home/AboutSection.tsx`, avec un `alt` descriptif :

   ```ts
   const CAROUSEL_SLIDES: CarouselSlide[] = [
     { src: "/images/about-carousel/ambiance-2024-1.jpg", alt: "Le public du DevFest Toulouse 2024" },
     { src: "/images/about-carousel/ambiance-2024-2.jpg", alt: "Atelier pendant le DevFest Toulouse 2024" },
   ];
   ```

Tant que `CAROUSEL_SLIDES` est vide, le bloc reste en texte seul (aucun
carrousel affiché) — pas de régression.
