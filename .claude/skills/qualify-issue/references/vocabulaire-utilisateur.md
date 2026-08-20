# Vocabulaire — parler au déclarant, pas au compilateur

Les issues de ce repo sont ouvertes par des **organisateurs du DevFest**, pas seulement par des développeurs. Une question mal formulée reste sans réponse, et l'issue s'enlise.

Ce lexique ne concerne **que les questions posées au déclarant**. Le reste de la qualification — cause racine, `fichier:ligne`, correctif — s'adresse à qui implémentera et reste technique.

## La règle qui compte le plus

**Toute question porte sa valeur par défaut.** Sans défaut, on oblige à répondre ; avec défaut, on permet de ne répondre que pour corriger.

> ❌ « Sur quel environnement as-tu vu le problème ? »
> ✅ « C'était sur le site en ligne ou sur la bêta ? Sauf indication contraire je pars du principe que c'est le site en ligne. »

## Lexique

| Ne pas écrire | Écrire |
|---|---|
| environnement (local / bêta / prod) | « sur le site en ligne ou sur la bêta ? » — **défaut : le site en ligne** |
| localhost:3000, `docker compose` | ne pas mentionner : un déclarant non-développeur n'a pas d'instance locale |
| « ouvre la console (F12) », onglet réseau, erreur CSP | ne pas demander — réclamer une capture d'écran à la place |
| « les deux chemins de code sont différents » | décrire ce que la personne **voit** : « juste après avoir choisi le fichier, ou une fois l'image ajoutée ? » |
| endpoint, payload, requête, 404, 500 | « la page », « le formulaire », « le message d'erreur affiché » |
| cache / invalidation / revalidation | « as-tu réessayé en rechargeant la page ? » |
| navigateur + version + user agent | « quel navigateur ? (Chrome, Firefox, Safari…) » — ne le demander que si le symptôme est visuel |
| responsive, viewport, breakpoint | « sur ordinateur ou sur téléphone ? » |
| build, déploiement, commit, branche | ne pas mentionner |
| « peux-tu reproduire de façon déterministe ? » | « est-ce que ça le fait à chaque fois ? » |
| slug, id, FK, modèle | nommer l'objet : « le sponsor », « l'article », « l'édition » |
| régression | « est-ce que ça marchait avant ? » |

## Formulations prêtes à l'emploi

- **Localiser** : « À quel endroit exactement ? Si tu peux, une capture d'écran de la page. »
- **Quand** : « À quel moment ça se produit — au chargement de la page, ou après avoir cliqué quelque part ? »
- **Ce qui est vu** : « Qu'est-ce qui s'affiche à la place ? Un cadre vide, un message d'erreur, ou autre chose ? »
- **Fréquence** : « Est-ce que ça le fait à chaque fois, ou seulement de temps en temps ? »
- **Avant / après** : « Est-ce que ça marchait avant ? Si oui, tu te souviens à peu près de quand ça a changé ? »

## Exemple réel — issue #371

Ce qui a été posté, et ce qu'il fallait poster :

| ❌ Posté | ✅ À la place |
|---|---|
| « Sur quel environnement ? Local (`localhost:3000`), bêta, ou prod ? » | « C'était sur le site en ligne ou sur la bêta ? Par défaut je pars sur le site en ligne. » |
| « Si tu peux ouvrir la console (F12), une erreur réseau ou CSP y apparaîtrait — c'est ce qui distinguerait définitivement “image non chargée” de “image mal cadrée”. » | *(supprimé)* — remplacé par la demande de capture |
| « L'aperçu **avant** de valider l'upload, ou la vignette **après** upload dans la médiathèque ? Les deux chemins de code sont différents. » | « À quel moment : juste après avoir choisi le fichier, ou une fois l'image ajoutée à la médiathèque ? » |

Trois questions devenaient deux, sans jargon, et la capture d'écran — qui aurait tout tranché d'un coup — passait en premier.
