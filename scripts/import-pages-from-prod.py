"""
One-shot import script: populate the ContentPage table from devfesttoulouse.fr.
Imports the Code of Conduct (FR + EN) and Legal Notice (FR, EN duplicated).

Usage:
    DFT_API_URL=https://beta.site.devfesttoulouse.fr \
    DFT_API_TOKEN=dft_dev_xxx \
    python scripts/import-pages-from-prod.py
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error


API_URL = os.environ.get("DFT_API_URL", "https://dev-j.site.devfesttoulouse.fr").rstrip("/")
API_TOKEN = os.environ["DFT_API_TOKEN"]

PROD_URLS = {
    "code-de-conduite": {
        "fr": "https://devfesttoulouse.fr/code-de-conduite",
        "en": "https://devfesttoulouse.fr/code-of-conduct",
        "titleFr": "Code de conduite",
        "titleEn": "Code of conduct",
    },
    "mentions-legales": {
        "fr": "https://devfesttoulouse.fr/mentions-legales",
        "en": None,  # No EN version exists — duplicate FR
        "titleFr": "Mentions légales",
        "titleEn": "Legal notice",
    },
}


def api(method, path, body=None):
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
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode('utf-8')[:300]}", file=sys.stderr)
        return None


def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read().decode("utf-8", errors="replace")


def extract_clean(html):
    """Extract the post-content body and strip Avada/WordPress wrappers."""
    start = html.find('<div class="post-content">')
    if start == -1:
        return None
    depth = 1
    pos = start + len('<div class="post-content">')
    while depth > 0 and pos < len(html):
        no = html.find("<div", pos)
        nc = html.find("</div>", pos)
        if nc == -1:
            break
        if no != -1 and no < nc:
            depth += 1
            pos = no + 4
        else:
            depth -= 1
            pos = nc + 6
    content = html[start + len('<div class="post-content">'):pos - len("</div>")]
    # Strip cosmetic attributes
    content = re.sub(r'\s+(style|class|id|data-[a-z-]+|align|target)="[^"]*"', "", content)
    # Flatten layout-only tags
    for tag in ("div", "nav", "article", "section", "span", "figure", "aside", "header", "footer"):
        content = re.sub(rf"</?{tag}[^>]*>", "", content)
    # Drop scripts and styles
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)
    # Tidy up whitespace
    content = re.sub(r"<p>\s*</p>", "", content)
    content = re.sub(r"\n\s*\n+", "\n\n", content)
    content = re.sub(r"[ \t]+", " ", content)
    return content.strip()


def upsert_page(slug, title_fr, title_en, content_fr, content_en):
    existing = api("GET", "/api/admin/pages") or []
    match = next((p for p in existing if p.get("slug") == slug), None)
    body = {
        "slug": slug,
        "titleFr": title_fr,
        "titleEn": title_en,
        "contentFr": content_fr,
        "contentEn": content_en,
    }
    if match:
        print(f"  . page {slug} exists (id={match['id']}), updating")
        api("PUT", f"/api/admin/pages/{match['id']}", body)
    else:
        print(f"  + page {slug}, creating")
        api("POST", "/api/admin/pages", body)


print("## Pages")
for slug, meta in PROD_URLS.items():
    print(f"\n[{slug}]")
    print(f"  fetching {meta['fr']}")
    html_fr = fetch(meta["fr"])
    content_fr = extract_clean(html_fr)
    print(f"  -> FR clean: {len(content_fr or '')} chars")

    if meta["en"]:
        print(f"  fetching {meta['en']}")
        html_en = fetch(meta["en"])
        content_en = extract_clean(html_en)
        print(f"  -> EN clean: {len(content_en or '')} chars")
    else:
        print(f"  no EN version — duplicating FR (legal text remains in French)")
        content_en = content_fr

    if not content_fr:
        print(f"  ! could not extract content from {meta['fr']}, skipping")
        continue

    upsert_page(slug, meta["titleFr"], meta["titleEn"], content_fr, content_en or content_fr)


print("\nDone.")
