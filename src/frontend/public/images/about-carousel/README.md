# Carrousel « Derrière le DevFest Toulouse »

Photos d'ambiance affichées dans le bloc « Derrière le DevFest Toulouse » de la
page d'accueil (issues #59 / #99), uniquement pendant la phase **annonce**.

## Gestion des images

Depuis #99, les images se gèrent **depuis le back-office** — plus besoin de
toucher au code :

1. Admin → **Paramètres → Carrousel**.
2. Ajouter une image (upload ou bibliothèque), renseigner son texte alternatif,
   réordonner / supprimer.
3. Enregistrer : la page d'accueil est revalidée automatiquement.

Les images uploadées atterrissent dans `public/uploads/`. Ce dossier
(`about-carousel/`) n'est plus utilisé pour stocker des fichiers ; la liste est
persistée dans le réglage `about_carousel`. Tant qu'aucune image n'est
configurée, le bloc reste en texte seul.
