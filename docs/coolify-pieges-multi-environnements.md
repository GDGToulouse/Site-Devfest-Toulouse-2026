# Coolify — pièges en environnement multi-projets / multi-environnements

> **Document générique réutilisable.** Cette note décrit un piège récurrent de Coolify quand plusieurs projets (ou plusieurs environnements d'un même projet) cohabitent sur la même instance. Elle peut être copiée/adaptée pour d'autres projets déployés via Coolify.

---

## Le problème en deux phrases

Sur une instance Coolify qui héberge plusieurs projets, **les services d'un projet peuvent involontairement parler aux services d'un autre projet** à cause du réseau Docker partagé `coolify` et de la résolution DNS Docker.

Combiné au fait que **les variables d'environnement Coolify ne sont disponibles au build qu'avec un toggle explicite**, des bugs très difficiles à diagnostiquer apparaissent : la config a l'air correcte au runtime mais le build a figé d'anciennes valeurs, ou les requêtes partent vers le bon nom de service mais arrivent au mauvais container.

## Les 4 points clés à vérifier sur tout projet Coolify

### 1. `container_name` dans le compose est ignoré

Coolify renomme systématiquement les containers avec son propre hash de projet (ex. `backend-jotu5qn6uevc1z8euqfmk4ox-205852288651`). Le `container_name` du compose est ignoré.

→ **Pour avoir un hostname stable**, utiliser `networks.<network>.aliases` au lieu de `container_name`.

### 2. Le réseau `coolify` est partagé entre tous les projets

Tout service connecté à ce réseau (typiquement le `frontend` pour être atteignable par Traefik) peut résoudre les noms de services d'autres projets. Si deux projets exposent un service `backend`, Docker DNS peut renvoyer celui de l'autre projet (priorité IPv6 ou ordre alphabétique selon les versions).

→ **Garder hors du réseau `coolify`** tout service qui n'a pas besoin d'être atteint par Traefik (typiquement les backends internes proxiés par le frontend).
→ **Donner à ces services un nom unique par environnement** via `networks.default.aliases`, par exemple `monprojet-${ENV_NAME}-backend`.

### 3. Les variables d'environnement Coolify sont runtime par défaut

Sur Coolify, chaque variable d'environnement a un toggle « **Available at Buildtime** » qui n'est **pas coché par défaut**. Sans ce toggle, la variable est uniquement injectée au runtime — pas pendant `docker build`.

→ **Cocher « Available at Buildtime »** pour toutes les variables utilisées par un build :
  - Variables figées dans le bundle Next.js / Vite / Webpack (URLs API, feature flags, `NEXT_PUBLIC_*`, `VITE_*`).
  - Variables interpolées dans des `ARG` Dockerfile.
  - Toute variable lue au moment de la compilation (ex. génération de manifest, schema GraphQL).

### 4. « Domains for X » n'est pas une variable d'environnement

Le champ « Domains for backend » (et équivalents) configure Traefik pour exposer publiquement le service. Ce **n'est pas** la variable d'environnement utilisée par les autres services pour s'adresser à ce backend en interne.

→ **Toujours configurer séparément** la variable d'environnement (`BACKEND_URL`, `API_URL`, …) qui contient le hostname interne Docker.

## Symptômes observables

- Erreurs `INVALID_ORIGIN`, CORS bloqués, ou auth qui échoue après un déploiement multi-env.
- Logs : le container backend de l'env A ne reçoit jamais de requêtes alors que le frontend A "marche" (les requêtes vont au backend d'un autre env).
- Réponses HTTP avec des headers qui ne correspondent pas à ce que ton backend met (ex. CSP, `referrer-policy`, `x-frame-options` différents → c'est un autre backend qui répond).
- `docker exec <frontend> getent hosts <service-backend>` retourne plusieurs IPs ou une IP IPv6 inattendue.
- Variable d'env correcte au runtime (`docker exec <container> env`), mais ancienne valeur figée dans `routes-manifest.json` ou équivalent.

## Diagnostic rapide

```bash
# Quel(s) container(s) répondent au nom du service ?
docker exec <frontend-container> getent hosts <nom-service-backend>
# Une seule IP du sous-réseau projet (10.0.x.x) attendue.

# Quels containers existent sur l'instance ?
docker ps --format '{{.Names}}\t{{.Networks}}' | grep <nom-service>

# Quelle URL le bundle frontend pointe-t-il (Next.js) ?
docker exec <frontend-container> grep -o 'http://[^"]*:4000' /app/.next/routes-manifest.json | sort -u

# Quel container reçoit réellement la requête ? (lancer puis déclencher la requête)
docker logs -f <backend-container-de-cet-env>
```

## Correctifs (pattern docker-compose)

```yaml
services:
  frontend:
    environment:
      # Pointer sur l'alias unique, pas le nom de service brut
      - BACKEND_URL=http://monprojet-${ENV_NAME:-local}-backend:4000
    networks:
      - default
      - coolify  # nécessaire pour Traefik

  backend:
    # Pas de container_name — Coolify l'ignore.
    # Pas de connexion au réseau `coolify` — évite le leak DNS.
    networks:
      default:
        aliases:
          - monprojet-${ENV_NAME:-local}-backend

networks:
  coolify:
    external: true
```

Et sur Coolify (pour chaque environnement) :
- `ENV_NAME=<nom-env>` (ex. `dev`, `beta`, `prod`)
- `BACKEND_URL=http://monprojet-<nom-env>-backend:4000`
- Cocher « Available at Buildtime » sur `BACKEND_URL` (et toutes les vars utilisées par le build).

---

## Prompt à utiliser sur un autre projet déployé sur Coolify

Copier-coller le prompt ci-dessous dans une session Claude Code (ou autre assistant) sur un projet Coolify pour vérifier qu'il n'est pas vulnérable au même bug :

```
Audit Coolify — vulnérabilité au leak inter-projets via le réseau partagé `coolify`.

Contexte : sur Coolify, plusieurs projets coexistent sur la même instance et partagent un réseau Docker externe nommé `coolify`. Trois pièges combinés peuvent provoquer un leak silencieux entre environnements (un service d'un projet/env A reçoit les requêtes destinées à un service d'un projet/env B portant le même nom) :

1. `container_name` dans docker-compose est ignoré par Coolify (renommage avec hash projet).
2. Le réseau `coolify` est partagé : tout service joint à ce réseau peut résoudre les noms de services d'autres projets via Docker DNS (priorité IPv6 ou ordre alphabétique). Si deux projets/envs exposent un service `backend`, `frontend` peut hit le mauvais.
3. Les variables d'environnement Coolify ne sont disponibles au build que si le toggle « Available at Buildtime » est coché. Une variable comme `BACKEND_URL` peut être correcte au runtime mais figée à une ancienne valeur dans le bundle (ex. `routes-manifest.json` de Next.js) si le build n'y a pas eu accès.

Audit demandé sur ce projet :
1. Lire les fichiers `docker-compose*.yml` (et tout fichier de déploiement Coolify pertinent).
2. Identifier les services qui :
   a. dépendent d'un autre service interne via son nom court (ex. `BACKEND_URL=http://backend:4000`),
   b. sont connectés au réseau externe `coolify`.
3. Pour chaque service exposé via Traefik (typiquement le frontend) :
   - Lister tous les noms de services internes qu'il appelle.
   - Vérifier si ces noms sont uniques globalement (improbable s'ils s'appellent `backend`, `api`, `db`, `redis`…) ou s'ils peuvent collisionner avec ceux d'autres projets sur la même instance Coolify.
4. Identifier les frameworks qui figent des URLs au build : Next.js (`rewrites`, `NEXT_PUBLIC_*`), Vite (`VITE_*`), Webpack (`DefinePlugin`), tout `ARG`/`ENV` Dockerfile lu par une étape `RUN build`.
5. Pour chaque variable d'env critique au build, indiquer si Coolify doit la marquer « Available at Buildtime » (la décision se fait dans l'UI Coolify, donc juste signaler les variables concernées).

Livrable : un rapport Markdown listant :
- Les risques identifiés (services à renommer, variables à passer en buildtime, services à sortir du réseau `coolify`).
- Les correctifs proposés sous forme de diff docker-compose et liste de variables Coolify à reconfigurer.
- Les vérifications post-déploiement à exécuter (commandes `docker exec ... getent hosts`, `docker logs`, etc.).

Si le projet n'est pas concerné (services aux noms uniques, pas de réseau partagé, pas de framework qui fige des URLs au build), le dire explicitement.
```
