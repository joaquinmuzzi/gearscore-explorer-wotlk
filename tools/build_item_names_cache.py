import json
import re
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parents[1]
GS_PATH = BASE_DIR / "GS.json"
CACHE_JSON = BASE_DIR / "item_names_cache.json"
CACHE_JS = BASE_DIR / "item-names.js"

HEADERS = {"User-Agent": "GsChecker item-names/1.0"}
ITEM_URL = "https://wotlk.evowow.com/?item={item_id}"


def load_gs_item_ids() -> list[str]:
    with GS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    ids: set[str] = set()

    def collect(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(k, str) and k.isdigit():
                    ids.add(k)
                collect(v)
        elif isinstance(obj, list):
            for v in obj:
                collect(v)
        elif isinstance(obj, str) and obj.isdigit():
            ids.add(obj)

    collect(data.get("GS_DATA", {}))
    collect(data.get("LEGENDARY", {}))
    return sorted(ids)


def load_cache() -> dict[str, str]:
    if not CACHE_JSON.exists():
        return {}
    try:
        with CACHE_JSON.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items() if str(k).isdigit()}
    except Exception:
        return {}
    return {}


def save_cache(cache: dict[str, str]) -> None:
    with CACHE_JSON.open("w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    js_content = "window.ITEM_NAMES = " + json.dumps(cache, ensure_ascii=False, indent=2) + ";\n"
    with CACHE_JS.open("w", encoding="utf-8") as f:
        f.write(js_content)


def parse_item_name(page_text: str) -> str | None:
    match = re.search(r"g_items[^\n]*?({.+?})", page_text)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except Exception:
        return None
    name = data.get("name_enus") or data.get("name")
    if not name:
        return None
    return str(name).strip()


def main() -> None:
    ids = load_gs_item_ids()
    cache = load_cache()
    missing = [item_id for item_id in ids if item_id not in cache]

    print(f"Total IDs: {len(ids)} | En cache: {len(cache)} | Faltan: {len(missing)}")
    session = requests.Session()

    for idx, item_id in enumerate(missing, 1):
        try:
            resp = session.get(ITEM_URL.format(item_id=item_id), headers=HEADERS, timeout=8)
            if resp.status_code == 200:
                name = parse_item_name(resp.text)
                if name:
                    cache[item_id] = name
        except Exception:
            pass

        if idx % 50 == 0:
            print(f"Procesados {idx}/{len(missing)}")
            save_cache(cache)

    save_cache(cache)
    print(f"Cache final: {len(cache)}")


if __name__ == "__main__":
    main()
