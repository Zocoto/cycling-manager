"""Build the checked-in FR -> EN UI catalog with a local Argos model.

The development-only dependencies and model live under .codex-tools and are
never bundled with the application. No application string leaves the machine.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".codex-tools" / "argos"
DATA = ROOT / ".codex-tools" / "argos-data"
CANDIDATES = ROOT / ".codex-tools" / "i18n-candidates.json"
OUTPUT = ROOT / "lib" / "i18n" / "generated-fr-en.json"

sys.path.insert(0, str(TOOLS))
os.environ["XDG_DATA_HOME"] = str(DATA)
os.environ.setdefault("CT2_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")

from argostranslate import translate  # noqa: E402


MANUAL_TRANSLATIONS = {
    "ACC": "ACC",
    "BAR": "FTR",
    "CLM": "TT",
    "DES": "DH",
    "END": "STA",
    "MO": "MO",
    "MOY": "AVG",
    "PAV": "COB",
    "PLA": "FL",
    "PRO": "PRL",
    "REC": "REC",
    "RES": "RES",
    "SPR": "SP",
    "VAL": "HIL",
}


def post_process(value: str) -> str:
    value = re.sub(r"\bCyclostrategist\b", "Cyclo Stratège", value, flags=re.I)
    value = re.sub(r"\bCyclo Strategist\b", "Cyclo Stratège", value, flags=re.I)
    value = re.sub(r"\bSports Director\b", "Sporting Director", value)
    value = re.sub(r"\brunners\b", "riders", value, flags=re.I)
    value = re.sub(r"\brunner\b", "rider", value, flags=re.I)
    return " ".join(value.split()).strip()


def write_catalog(catalog: dict[str, str], candidates: list[str]) -> None:
    active_catalog = {
        source: catalog[source] for source in candidates if catalog.get(source)
    }
    OUTPUT.write_text(
        json.dumps(dict(sorted(active_catalog.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if not CANDIDATES.exists():
        raise SystemExit("Run: node scripts/build-i18n-catalog.mjs --export-candidates")

    candidates: list[str] = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    catalog: dict[str, str] = (
        json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    )
    catalog.update(MANUAL_TRANSLATIONS)
    missing = [candidate for candidate in candidates if not catalog.get(candidate)]
    print(f"Translating {len(missing)} strings locally…", flush=True)

    for index, source in enumerate(missing, start=1):
        catalog[source] = post_process(translate.translate(source, "fr", "en"))
        if index % 50 == 0 or index == len(missing):
            write_catalog(catalog, candidates)
            print(f"Translated {index}/{len(missing)} strings.", flush=True)

    if not missing:
        write_catalog(catalog, candidates)


if __name__ == "__main__":
    main()
