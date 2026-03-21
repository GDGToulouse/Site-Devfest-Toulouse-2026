# Modèle de données — Historique DevFest Toulouse

Description du fichier `data/devfest-history.json`.

---

## Structure générale

```json
{
  "editions": {
    "<année>": {
      "date": "YYYY-MM-DD",
      "venue": "Nom du lieu",
      "speakers": [ ... ],
      "sessions": [ ... ]
    }
  }
}
```

Le fichier contient une entrée par édition (2016, 2017, 2018, 2019, 2023, 2024, 2025).
Pas d'éditions en 2020, 2021 et 2022 (COVID).

---

## Édition

| Champ | Type | Description |
|-------|------|-------------|
| `date` | `string` | Date de l'événement au format `YYYY-MM-DD` |
| `venue` | `string` | Nom et localisation du lieu |
| `speakers` | `array` | Liste des conférenciers de cette édition |
| `sessions` | `array` | Liste des conférences de cette édition |

---

## Speaker

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `name` | `string` | oui | Nom complet du conférencier |
| `company` | `string` | non | Entreprise ou organisation |
| `city` | `string` | non | Ville et pays (`"Toulouse, France"`) |
| `bio` | `string` | non | Biographie (texte brut ou HTML selon l'édition) |
| `photoUrl` | `string` | non | URL de la photo (présent pour 2016-2019, absent pour 2023+) |
| `socials` | `array` | non | Liens vers les réseaux sociaux |

### Socials

| Champ | Type | Description |
|-------|------|-------------|
| `type` | `string` | Type de réseau : `twitter`, `github`, `website` |
| `url` | `string` | URL du profil |

Pour les éditions 2016-2019, le format peut varier (`icon`/`link`/`name` au lieu de `type`/`url`).

---

## Session

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `title` | `string` | oui | Titre de la conférence |
| `description` | `string` | oui | Description complète (texte brut ou HTML) |
| `speakers` | `array<string>` | oui | Noms des conférenciers associés |
| `language` | `string` | oui | Langue : `fr` ou `en` |
| `format` | `string` | oui | Format : `conference`, `quickie` ou `keynote` |
| `complexity` | `string` | non | Niveau : `débutant`, `intermédiaire` ou `confirmé` |
| `tags` | `array<string>` | non | Catégories thématiques (présent pour 2016-2019) |
| `youtube` | `string` | non | URL de la vidéo YouTube (quand disponible) |

---

## Sources des données

| Éditions | Source | Format d'origine |
|----------|--------|-----------------|
| 2016 | GitHub `GDGToulouse/site-devfest-toulouse-2016` | JSON (Hoverboard/Polymer) |
| 2017 | GitHub `GDGToulouse/site-devfest-toulouse-2017` | JSON (Hoverboard/Firebase) |
| 2018 | GitHub `GDGToulouse/site-devfest-toulouse-2018` | JSON (Hoverboard/Polymer 2) |
| 2019 | GitHub `GDGToulouse/site-devfest-2019` | YAML frontmatter (Hugo) |
| 2023-2025 | API REST `devfesttoulouse.fr/wp-json/cpt/v1/` | WordPress CPT + relations Toolset |

### Mapping des champs WordPress (2023-2025)

| Champ WordPress | Valeur | Signification |
|-----------------|--------|---------------|
| `wpcf-langue` | `1` | Français |
| `wpcf-langue` | `2` | Anglais |
| `wpcf-niveau` | `1` | Débutant |
| `wpcf-niveau` | `2` | Intermédiaire |
| `wpcf-niveau` | `3` | Confirmé |
| `wpcf-format` | `1` | Conférence |
| `wpcf-format` | `2` | Quickie |
| `wpcf-format` | `3` | Keynote |

---

## Volumétrie

| Édition | Speakers | Sessions |
|---------|----------|----------|
| 2016 | 23 | 23 |
| 2017 | 48 | 38 |
| 2018 | 42 | 39 |
| 2019 | 44 | 40 |
| 2023 | 49 | 38 |
| 2024 | 57 | 49 |
| 2025 | 64 | 55 |
| **Total** | **327** | **282** |

---

## Limites connues

- Les photos des speakers 2023-2025 ne sont pas dans le JSON (stockées dans WordPress via `featured_media` ID)
- Les descriptions peuvent contenir du HTML (balises `<br/>`, `<a>`, `<p>`) ou du texte brut selon l'édition
- Le format des `socials` n'est pas uniforme entre les éditions anciennes (2016-2019) et récentes (2023+)
- Les `tags` thématiques ne sont présents que pour les éditions 2016-2019
- Les sessions exclues : pauses, repas, afterparties, office hours, placeholders
