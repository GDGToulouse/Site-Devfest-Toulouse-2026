"""
One-shot import script: populate dev-j with data extracted from the production
site (devfesttoulouse.fr). Run manually after a dev-j deploy when the dataset
needs to be refreshed. Not included in the regular seed — this lives under
scripts/ so it can evolve independently of schema migrations.

Usage:
    DFT_API_URL=https://dev-j.site.devfesttoulouse.fr \\
    DFT_API_TOKEN=dft_dev_xxx \\
    python scripts/import-from-prod.py
"""
import json
import os
import sys
import urllib.request
import urllib.error


API_URL = os.environ.get("DFT_API_URL", "https://dev-j.site.devfesttoulouse.fr").rstrip("/")
API_TOKEN = os.environ["DFT_API_TOKEN"]


def api(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(
        f"{API_URL}{path}",
        method=method,
        headers={
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode('utf-8')[:200]}", file=sys.stderr)
        return None


def upsert_edition(year: int, fields: dict):
    existing = api("GET", "/api/admin/editions")
    match = next((e for e in existing if e["year"] == year), None)
    if match:
        print(f"  . edition {year} exists (id={match['id']}), updating")
        api("PUT", f"/api/admin/editions/{match['id']}", fields)
        return match["id"]
    else:
        print(f"  + edition {year}, creating")
        res = api("POST", "/api/admin/editions", {"year": year, **fields})
        return res["id"] if res else None


def upsert_article(slug: str, fields: dict):
    existing = api("GET", "/api/admin/articles?page=1&limit=100")
    if not existing:
        return
    articles = existing.get("articles", existing) if isinstance(existing, dict) else existing
    match = next((a for a in articles if a.get("slug") == slug), None)
    if match:
        print(f"  . article {slug} exists (id={match['id']}), updating")
        api("PUT", f"/api/admin/articles/{match['id']}", fields)
    else:
        print(f"  + article {slug}, creating")
        api("POST", "/api/admin/articles", {"slug": slug, **fields})


# ---------- EDITIONS ---------------------------------------------------------

print("## Editions")

# 2025 — data from https://devfesttoulouse.fr/about/devfest-toulouse-2025/
upsert_edition(2025, {
    "status": "SEE_YOU_NEXT_YEAR",
    "venueName": "Centre de Congrès et d'Exposition Diagora",
    "venueAddress": "Labège",
    "startDate": "2025-11-20T00:00:00.000Z",
    "galleryUrl": "https://photos.app.goo.gl/ivdU97WnbtpVCQvy6",
    "aftermovieUrl": "https://www.youtube.com/watch?v=nCjk1T8G1WE",
    "archivedSiteUrl": "https://devfesttoulouse.fr/about/devfest-toulouse-2025/",
})

# 2024 — data from https://devfesttoulouse.fr/about/devfest-toulouse-2024/
upsert_edition(2024, {
    "status": "SEE_YOU_NEXT_YEAR",
    "startDate": "2024-11-07T00:00:00.000Z",
    "venueName": "Centre de Congrès et d'Exposition Diagora",
    "venueAddress": "Labège",
    "galleryUrl": "https://photos.app.goo.gl/ytJD6ZESga1Frg6Z6",
    "archivedSiteUrl": "https://devfesttoulouse.fr/about/devfest-toulouse-2024/",
})

# 2023 — data from https://devfesttoulouse.fr/about/edition-2023/
upsert_edition(2023, {
    "status": "SEE_YOU_NEXT_YEAR",
    "startDate": "2023-11-16T00:00:00.000Z",
    "venueName": "Centre de Congrès et d'Exposition Diagora",
    "venueAddress": "Labège",
    "archivedSiteUrl": "https://devfesttoulouse.fr/about/edition-2023/",
})


# ---------- ARTICLES --------------------------------------------------------
#
# Public-facing articles scraped from the production site's /actualites/ page.
# titleFr/En are kept equal until translations are available. Body content is
# not copied here (would require per-article scraping). Admins can re-edit.

print("\n## Articles")

articles = [
    {
        "slug": "prepare-ton-devfest-toulouse-2025",
        "titleFr": "Prépare ton DevFest Toulouse 2025",
        "titleEn": "Get ready for DevFest Toulouse 2025",
        "publishedAt": "2025-11-10T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-octobre-2025",
        "titleFr": "Les coulisses – Octobre 2025",
        "titleEn": "Behind the scenes – October 2025",
        "publishedAt": "2025-10-14T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-juillet-2025",
        "titleFr": "Les coulisses – Juillet 2025",
        "titleEn": "Behind the scenes – July 2025",
        "publishedAt": "2025-07-30T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-avril-2025",
        "titleFr": "Les coulisses – Avril 2025",
        "titleEn": "Behind the scenes – April 2025",
        "publishedAt": "2025-05-06T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-mars-2025",
        "titleFr": "Les coulisses – Mars 2025",
        "titleEn": "Behind the scenes – March 2025",
        "publishedAt": "2025-03-27T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "proposer-une-conference-le-cfp",
        "titleFr": "Proposer une conférence – la réponse au CFP",
        "titleEn": "Proposing a talk – responding to the CFP",
        "publishedAt": "2025-03-18T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-fevrier-2025",
        "titleFr": "Les coulisses – Février 2025",
        "titleEn": "Behind the scenes – February 2025",
        "publishedAt": "2025-03-06T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-janvier-2025",
        "titleFr": "Les coulisses – Janvier 2025",
        "titleEn": "Behind the scenes – January 2025",
        "publishedAt": "2025-01-23T00:00:00.000Z",
        "editionYear": 2025,
    },
    {
        "slug": "les-coulisses-novembre-2024",
        "titleFr": "Les coulisses – Novembre 2024",
        "titleEn": "Behind the scenes – November 2024",
        "publishedAt": "2024-11-26T00:00:00.000Z",
        "editionYear": 2024,
    },
    {
        "slug": "devfest-toulouse-2024-cest-parti-on-fait-le-point",
        "titleFr": "DevFest Toulouse 2024 : c'est parti. On fait le point",
        "titleEn": "DevFest Toulouse 2024: we're on our way. Let's take stock",
        "publishedAt": "2024-05-03T00:00:00.000Z",
        "editionYear": 2024,
    },
]

# Fetch editions once to resolve editionYear -> editionId
editions = api("GET", "/api/admin/editions")
year_to_id = {e["year"]: e["id"] for e in editions}

for a in articles:
    edition_id = year_to_id.get(a["editionYear"])
    slug = a["slug"]
    body_placeholder = "<p>Article publié sur devfesttoulouse.fr. Contenu à recopier manuellement ou à laisser vide en attendant.</p>"
    # Note: the admin API sets publishedAt = now() on DRAFT->PUBLISHED transition
    # and does not let us override it. Historical dates must be fixed later.
    upsert_article(slug, {
        "titleFr": a["titleFr"],
        "titleEn": a["titleEn"],
        "contentFr": body_placeholder,
        "contentEn": body_placeholder,
        "excerptFr": a["titleFr"],
        "excerptEn": a["titleEn"],
        "publicationStatus": "PUBLISHED",
        "editionIds": [edition_id] if edition_id else [],
    })


print("\nDone.")
