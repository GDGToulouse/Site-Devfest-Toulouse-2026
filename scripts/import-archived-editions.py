"""
One-shot import: populate archived editions (2016, 2017, 2018, 2019) using
data scraped from the legacy per-year sites:
  - https://2016.devfesttoulouse.fr/data/{sessions,speakers}.json
  - https://2017.devfesttoulouse.fr/data/{sessions,speakers}.json
  - https://2018.devfesttoulouse.fr/data/{sessions,speakers}.json
  - 2019: stats hardcoded (HTML-only, no data API on that site)

For each year we upsert the Edition (date, venue, archivedSiteUrl) and
its KeyFigures (sessions count, speakers count). The Speaker/Session
entities themselves can't be imported — there is no schema for them yet.

Usage:
    DFT_API_URL=https://beta.site.devfesttoulouse.fr \
    DFT_API_TOKEN=dft_dev_xxx \
    python scripts/import-archived-editions.py
"""
import json
import os
import sys
import urllib.request
import urllib.error


API_URL = os.environ.get("DFT_API_URL", "https://dev-j.site.devfesttoulouse.fr").rstrip("/")
API_TOKEN = os.environ["DFT_API_TOKEN"]


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
            text = r.read().decode("utf-8")
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode('utf-8')[:300]}", file=sys.stderr)
        return None


def fetch_json(url):
    try:
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as e:
        print(f"  ! could not fetch {url}: {e}")
        return None


def count_items(data, key=None):
    """Count entries in a JSON file that may be a list or a dict-of-objects."""
    if data is None:
        return 0
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        if key and key in data:
            return count_items(data[key])
        return len(data)
    return 0


def count_real_sessions(sessions_data, speakers_data):
    """Filter out break/lunch entries (no speaker assigned) so the count
    reflects actual talks, not schedule slots."""
    items = sessions_data
    if isinstance(sessions_data, dict) and "sessions" in sessions_data:
        items = sessions_data["sessions"]
    if isinstance(items, dict):
        items = list(items.values())
    if not isinstance(items, list):
        return 0
    def has_speaker_or_track(s):
        if s.get("speakers"):
            return True
        track = s.get("track")
        if track:
            return True
        return False
    talks = [s for s in items if not s.get("isBreak") and has_speaker_or_track(s)]
    # Fallback: if the heuristic kills everything, take total minus obvious breaks
    if len(talks) < 5:
        talks = [s for s in items if not s.get("isBreak")]
    return len(talks)


# Static facts collected from the archived sites
EDITIONS = [
    {
        "year": 2016,
        "startDate": "2016-11-03T00:00:00.000Z",
        "venueName": "Centre de Congrès Pierre Baudis",
        "venueAddress": "Toulouse",
        "archivedSiteUrl": "https://2016.devfesttoulouse.fr/",
        "sessions_url": "https://2016.devfesttoulouse.fr/data/sessions.json",
        "speakers_url": "https://2016.devfesttoulouse.fr/data/speakers.json",
    },
    {
        "year": 2017,
        "startDate": "2017-09-28T00:00:00.000Z",
        "venueName": "Centre de Congrès Pierre Baudis",
        "venueAddress": "Toulouse",
        "archivedSiteUrl": "https://2017.devfesttoulouse.fr/",
        "sessions_url": "https://2017.devfesttoulouse.fr/data/sessions.json",
        "speakers_url": "https://2017.devfesttoulouse.fr/data/speakers.json",
    },
    {
        "year": 2018,
        "startDate": "2018-11-08T00:00:00.000Z",
        "venueName": "Centre de Congrès Pierre Baudis",
        "venueAddress": "Toulouse",
        "archivedSiteUrl": "https://2018.devfesttoulouse.fr/",
        "sessions_url": "https://2018.devfesttoulouse.fr/data/sessions.json",
        "speakers_url": "https://2018.devfesttoulouse.fr/data/speakers.json",
    },
    {
        "year": 2019,
        "startDate": "2019-10-03T00:00:00.000Z",
        "venueName": "Centre de Congrès Pierre Baudis",
        "venueAddress": "Toulouse",
        "archivedSiteUrl": "https://2019.devfesttoulouse.fr/",
        # No machine-readable data feed for this year — values left null below.
        "sessions_url": None,
        "speakers_url": None,
    },
]


def upsert_edition(year, fields):
    existing = api("GET", "/api/admin/editions") or []
    match = next((e for e in existing if e["year"] == year), None)
    body = {
        "status": "SEE_YOU_NEXT_YEAR",
        "startDate": fields["startDate"],
        "venueName": fields["venueName"],
        "venueAddress": fields["venueAddress"],
        "archivedSiteUrl": fields["archivedSiteUrl"],
    }
    if match:
        print(f"  . edition {year} exists (id={match['id']}), updating")
        api("PUT", f"/api/admin/editions/{match['id']}", body)
        return match["id"]
    print(f"  + edition {year}, creating")
    res = api("POST", "/api/admin/editions", {"year": year, **body})
    return res["id"] if res else None


def set_key_figures(edition_id, sessions_count, speakers_count):
    figures = []
    if speakers_count:
        figures.append({
            "icon": "microphone",
            "value": str(speakers_count),
            "labelFr": "Conférenciers",
            "labelEn": "Speakers",
        })
    if sessions_count:
        figures.append({
            "icon": "calendar",
            "value": str(sessions_count),
            "labelFr": "Sessions",
            "labelEn": "Sessions",
        })
    if not figures:
        print(f"    no key figures available for this year")
        return
    res = api("PUT", f"/api/admin/editions/{edition_id}/key-figures", figures)
    print(f"    key figures set: {sessions_count} sessions, {speakers_count} speakers")


print("## Archived editions (2016 to 2019)\n")

for ed in EDITIONS:
    year = ed["year"]
    print(f"[{year}]")
    edition_id = upsert_edition(year, ed)
    if edition_id is None:
        print(f"  ! upsert failed, skipping key figures")
        continue

    sessions = fetch_json(ed["sessions_url"]) if ed["sessions_url"] else None
    speakers = fetch_json(ed["speakers_url"]) if ed["speakers_url"] else None
    sessions_count = count_real_sessions(sessions, speakers) if sessions else 0
    speakers_count = count_items(speakers, key="speakers")

    set_key_figures(edition_id, sessions_count, speakers_count)
    print()

print("Done.")
