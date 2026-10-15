#!/usr/bin/env python3
"""Builds Lift's bundled exercise catalog from a clone of hasaneyldrm/exercises-dataset.

    python3 -I scripts/import-exercise-dataset.py <path-to-clone>

Reads <clone>/data/exercises.json and ExerciseMedia/seed-map.json, then writes:

  Packages/LiftKit/Sources/LiftCore/Resources/exercise-catalog.json   compact, English only
  ExerciseMedia/ATTRIBUTION.md                                         the dataset and media notices

Only text is copied (the dataset's MIT-licensed part). The images and GIFs are (c) Gym visual and are never copied:
the catalog keeps their paths, and the app loads them at runtime from raw.githubusercontent.com at the pinned commit.
Standard library only, so it runs anywhere with `python3 -I`.
"""

import json
import re
import sys
from pathlib import Path

IOS = Path(__file__).resolve().parent.parent
SEED_MAP = IOS / "ExerciseMedia" / "seed-map.json"
CATALOG = IOS / "Packages" / "LiftKit" / "Sources" / "LiftCore" / "Resources" / "exercise-catalog.json"
ATTRIBUTION = IOS / "ExerciseMedia" / "ATTRIBUTION.md"
SOURCE = "https://github.com/hasaneyldrm/exercises-dataset"
LICENSE = "MIT (data); media © Gym visual — https://gymvisual.com/, not included"
MEDIA_CREDIT = "© Gym visual — https://gymvisual.com/"
MAX_BYTES = 2 * 1024 * 1024

# UTF-8 text that was decoded as Windows-1251 or Windows-1252 somewhere upstream ("45в°" for "45°").
MOJIBAKE = {
    "в°": "°",
    "В°": "°",
    "Â°": "°",
    "â€™": "’",
    "â€˜": "‘",
    "â€œ": "“",
    "â€\u009d": "”",
    "â€“": "–",
    "â€”": "—",
    "Â ": " ",
}
SMALL_WORDS = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}
UPPER_WORDS = {"ez": "EZ", "jm": "JM", "pov": "POV", "sz": "SZ", "t": "T", "v": "V", "w": "W", "y": "Y", "l": "L"}


def fix_text(text):
    for bad, good in MOJIBAKE.items():
        text = text.replace(bad, good)
    return " ".join(text.split())


def title_word(word, first):
    """One word of a name; hyphenated parts are cased one by one ("sit-up" -> "Sit-Up", "t-bar" -> "T-Bar")."""
    if "-" in word:
        return "-".join(title_word(part, first and index == 0) for index, part in enumerate(word.split("-")))
    lower = word.lower()
    if lower in UPPER_WORDS:
        return UPPER_WORDS[lower]
    if not first and lower in SMALL_WORDS:
        return lower
    if not lower[:1].isalpha():
        return lower  # "3/4", "45°", "360"
    return lower[:1].upper() + lower[1:]


def title_case(name):
    name = fix_text(name).replace("_", " ")
    name = re.sub(r"\bv\. ?(\d+)", r"v\1", name)  # "row v. 2" -> "row v2"
    words = []
    for index, raw in enumerate(name.split(" ")):
        opener = raw.startswith("(")
        core = raw.lstrip("(")
        if re.fullmatch(r"v\d+\)?", core):
            words.append(("(" if opener else "") + core)
            continue
        first = index == 0 or opener or (words and words[-1].endswith("."))
        words.append(("(" if opener else "") + title_word(core, first))
    return " ".join(words)


def entry(record):
    steps = [fix_text(step) for step in record["instruction_steps"].get("en", []) if step.strip()]
    if not steps:
        raise SystemExit(f"{record['id']}: no English steps")
    for field in ("image", "gif_url"):
        if not re.fullmatch(r"(images|videos)/[A-Za-z0-9_-]+\.(jpg|gif)", record[field]):
            raise SystemExit(f"{record['id']}: unexpected {field} {record[field]!r}")
    return {
        "id": record["id"],
        "name": title_case(record["name"]),
        "category": fix_text(record["category"]),
        "bodyPart": fix_text(record["body_part"]),
        "equipment": fix_text(record["equipment"]),
        "target": fix_text(record["target"]),
        "secondary": [fix_text(muscle) for muscle in record["secondary_muscles"]],
        "muscleGroup": fix_text(record["muscle_group"]),
        "steps": steps,
        "image": record["image"],
        "gif": record["gif_url"],
    }


def commit_of(clone):
    """The clone's HEAD commit, read from .git directly so no git config or hook in the clone ever runs."""
    git = clone / ".git"
    head = (git / "HEAD").read_text(encoding="utf-8").strip()
    if head.startswith("ref: "):
        ref = head[5:]
        loose = git / ref
        if loose.is_file():
            head = loose.read_text(encoding="utf-8").strip()
        else:
            packed = (git / "packed-refs").read_text(encoding="utf-8").splitlines()
            head = next((line.split()[0] for line in packed if line.endswith(" " + ref)), "")
    if not re.fullmatch(r"[0-9a-f]{40}", head):
        raise SystemExit(f"could not read the clone's commit ({head!r})")
    return head


def build(clone):
    records = json.loads((clone / "data" / "exercises.json").read_text(encoding="utf-8"))
    seed_map = json.loads(SEED_MAP.read_text(encoding="utf-8"))
    commit = commit_of(clone)
    if commit != seed_map["commit"]:
        raise SystemExit(f"clone is at {commit}, seed-map.json pins {seed_map['commit']}")
    entries = sorted((entry(record) for record in records), key=lambda item: item["id"])
    ids = {item["id"] for item in entries}
    if len(ids) != len(entries):
        raise SystemExit("duplicate ids in the dataset")
    seeds = {number: seed["dataset"] for number, seed in seed_map["seeds"].items()}
    missing = [number for number, dataset_id in seeds.items() if dataset_id not in ids]
    if missing:
        raise SystemExit(f"seed-map.json points at missing ids for seeds {missing}")
    text = json.dumps(entries, ensure_ascii=False)
    leftovers = [bad for bad in MOJIBAKE if bad in text]
    if leftovers:
        raise SystemExit(f"mojibake left: {leftovers}")
    return {
        "commit": commit,
        "source": SOURCE,
        "license": LICENSE,
        "attribution": MEDIA_CREDIT,
        "seeds": dict(sorted(seeds.items(), key=lambda item: int(item[0]))),
        "exercises": entries,
    }


def attribution_text(clone, commit):
    mit = (clone / "LICENSE").read_text(encoding="utf-8").split("-" * 20)[0].strip()
    return f"""# Exercise catalog: attribution

Lift's exercise catalog (`Packages/LiftKit/Sources/LiftCore/Resources/exercise-catalog.json`) is built by
`scripts/import-exercise-dataset.py` from the exercises dataset at {SOURCE}, commit `{commit}`.

## Dataset text: MIT

The names, categories, body parts, equipment, muscles and English instruction steps are used under the MIT licence:

```text
{mit}
```

## Media: © Gym visual, not included

The thumbnails and animations are **{MEDIA_CREDIT}**. They are not covered by the MIT licence and are **not
copied into this repository or the app bundle**. The app loads them at runtime, at their published 180×180 size,
from `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/{commit}/<path>`, and shows the credit
"© Gym visual" (linking to https://gymvisual.com/) on every screen that displays them. Their use is governed by
Gym visual's terms: https://gymvisual.com/content/3-terms-and-conditions-of-use
"""


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    clone = Path(sys.argv[1]).resolve()
    catalog = build(clone)
    data = json.dumps(catalog, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n"
    if len(data) > MAX_BYTES:
        raise SystemExit(f"catalog is {len(data)} bytes; keep it under {MAX_BYTES}")
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_bytes(data)
    ATTRIBUTION.write_text(attribution_text(clone, catalog["commit"]), encoding="utf-8")
    print(f"{len(catalog['exercises'])} exercises, {len(data)} bytes -> {CATALOG.relative_to(IOS)}")


if __name__ == "__main__":
    main()
