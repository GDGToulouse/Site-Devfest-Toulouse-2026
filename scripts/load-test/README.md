# Test de charge du site public (#690)

Mesure combien de visiteurs simultanés le site encaisse avant que les pages ralentissent ou échouent, et quelle couche cède la première. À rejouer avant chaque édition, et après tout changement de cache, de limite de débit ou d'hébergement.

## Règles

- **Contre la beta (ou dev-j), jamais contre la prod** : `site.js` refuse `devfesttoulouse.fr`.
- **La beta partage le VPS avec la prod** : lancer `watch-prod.sh` dans un second terminal. Il arrête k6 dès que la prod répond trois fois de suite en plus de 2 s, ou plus du tout.
- Prévenir l'équipe, choisir un créneau calme, et suivre `docker stats` sur le VPS pendant la montée en charge.

## Outil

[k6](https://grafana.com/docs/k6/) : `brew install k6`.

## Lancer

```bash
# Terminal 1 : garde-fou de la prod
sh scripts/load-test/watch-prod.sh

# Terminal 2 : vérifier le script à très faible charge (2 visiteurs, 45 s)
k6 run scripts/load-test/site.js

# Puis la montée par paliers : 50 → 100 → 200 → 400 visiteurs, 2 min chacun
PROFILE=steps k6 run scripts/load-test/site.js

# Autre cible
BASE_URL=https://dev-j.site.devfesttoulouse.fr k6 run scripts/load-test/site.js
```

**Cache froid** : purger le cache de la cible juste avant un passage (back-office, « Vider le cache »), puis lancer `PROFILE=steps`. Le premier palier mesure alors le recalcul de chaque page.

## Ce que fait le scénario

- `pages` : un visiteur du jour J enchaîne accueil, programme, une conférence, son speaker et les sponsors, avec des temps de lecture, et charge les images optimisées (`/_next/image`) de chaque page.
- `api` : un appel par seconde à l'API des avis du public, pour voir si le backend ralentit sous la charge des pages.

Le test s'arrête de lui-même au premier palier où plus de 2 % des pages échouent, ou que le p95 des pages dépasse 4 s : ce palier est la réponse.

## Limites à connaître

- **Une seule IP source** : les appels `/api/*` du navigateur sont limités à 200 par minute et par IP. C'est pourquoi le scénario `api` reste à 1 appel par seconde. Un vrai public, réparti sur des centaines d'IP, n'atteint pas cette limite.
- **Débit du poste qui lance k6** : chaque visiteur reçoit environ 125 Ko/s, images comprises. À 400 visiteurs, c'est environ 50 Mo/s : une connexion trop lente plafonne le test avant le site. Vérifier `data_received` dans le résumé.
- La mesure porte sur le site rendu par Next et le backend, pas sur les fichiers JavaScript et CSS statiques, servis depuis le cache du navigateur après la première visite.
