#!/usr/bin/env python3
"""Turn a template JSON file into a lift://templates link (format: lift/TEMPLATE-LINKS.md).

    python3 lift/scripts/make-template-link.py my-templates.json
    python3 lift/scripts/make-template-link.py - < my-templates.json

Keep the JSON file outside the repository: it is personal data. The script reads it, checks the shape and the
size cap the app enforces, and prints the link. It writes nothing.
"""

import base64
import json
import sys

VERSION = 1
MAX_JSON_BYTES = 12_288  # TemplateLink.maximumJSONBytes
LOADS = {"total", "hand", "side", "bw"}


def check(payload):
    """Raise ValueError for the problems the app would report, so a bad link is never sent."""
    if payload.get("v") != VERSION:
        raise ValueError(f'"v" must be {VERSION}')
    templates = payload.get("templates")
    if not isinstance(templates, list) or not 1 <= len(templates) <= 20:
        raise ValueError('"templates" must hold 1 to 20 templates')
    for i, template in enumerate(templates):
        where = f"templates[{i}]"
        name = str(template.get("name", "")).strip()
        if not 1 <= len(name) <= 60:
            raise ValueError(f"{where}.name must be 1 to 60 characters")
        exercises = template.get("exercises")
        if not isinstance(exercises, list) or not 1 <= len(exercises) <= 30:
            raise ValueError(f"{where}.exercises must hold 1 to 30 exercises")
        unit = template.get("unit", payload.get("unit"))
        if unit is not None and unit not in ("kg", "lb"):
            raise ValueError(f'{where}.unit must be "kg" or "lb"')
        for j, exercise in enumerate(exercises):
            spot = f"{where}.exercises[{j}]"
            if not 1 <= len(str(exercise.get("name", "")).strip()) <= 80:
                raise ValueError(f"{spot}.name must be 1 to 80 characters")
            if exercise.get("weight") is not None and unit is None:
                raise ValueError(f'{where} has a weight but no "unit"')
            if exercise.get("load") not in (None, *LOADS):
                raise ValueError(f"{spot}.load must be one of {sorted(LOADS)}")


def link(payload):
    """The link for `payload`: compact JSON, base64url without padding."""
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    if len(data) > MAX_JSON_BYTES:
        raise ValueError(f"the JSON is {len(data)} bytes; the app reads at most {MAX_JSON_BYTES}")
    encoded = base64.urlsafe_b64encode(data).decode().rstrip("=")
    return f"lift://templates?d={encoded}"


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    source = sys.stdin if argv[1] == "-" else open(argv[1], encoding="utf-8")
    with source:
        payload = json.load(source)
    try:
        check(payload)
        print(link(payload))
    except ValueError as problem:
        print(f"make-template-link: {problem}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
