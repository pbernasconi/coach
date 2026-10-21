#!/usr/bin/env python3
"""Checks that every remote Swift package in an XcodeGen project.yml is pinned to one exact version.

    scripts/check-vendor-pins.py [--spec project.yml] [--mirror Tools/VendorPins/Package.swift] [--allow NAME]
    scripts/check-vendor-pins.py --self-test

A range (`from:`, `majorVersion:`, `minorVersion:`, `branch:`) lets a new upstream tag change what ships with
no change in the repo, so the check fails on it. `exactVersion:` (or `version:`) and `revision:` pass.
`--allow NAME` accepts a range for one package on purpose.

Dependabot cannot read project.yml. A small mirror Package.swift that repeats each pin with
`.package(url: ..., exact: ...)` lets it propose updates. With `--mirror`, the check also fails when:
  - the mirror pins a URL that project.yml does not pin, or pins another version;
  - a target links a pinned remote package that the mirror does not list.

Python 3.9+ standard library only. Exit status 1 when a problem is found.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FIXED_KEYS = ("exactVersion", "version", "revision")
RANGE_KEYS = ("from", "majorVersion", "minorVersion", "branch", "minVersion", "maxVersion")


def normalize_url(url: str) -> str:
    return re.sub(r"\.git$", "", url.strip().rstrip("/")).lower()


def unquote(value: str) -> str:
    value = value.split(" #", 1)[0].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        return value[1:-1]
    return value


def remote_packages(yaml: str) -> dict[str, dict[str, str]]:
    """The `packages:` entries of project.yml that have a `url:`, as {name: {key: value}}."""
    packages: dict[str, dict[str, str]] = {}
    inside = False
    current: str | None = None
    entry_indent = None
    for raw in yaml.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            inside = line.split(":", 1)[0] == "packages"
            current = None
            continue
        if not inside:
            continue
        if entry_indent is None:
            entry_indent = indent
        if indent == entry_indent:
            name, _, rest = line.strip().partition(":")
            current = name.strip().strip("'\"")
            packages[current] = {}
            rest = rest.strip()
            if rest.startswith("{") and rest.endswith("}"):
                # Flow style: Name: { url: https://..., exactVersion: 1.2.3 }
                for pair in rest[1:-1].split(","):
                    key, _, value = pair.partition(":")
                    if key.strip():
                        packages[current][key.strip()] = unquote(value)
        elif current is not None and indent > entry_indent and ":" in line:
            key, value = line.strip().split(":", 1)
            packages[current][key.strip()] = unquote(value)
    return {name: props for name, props in packages.items() if "url" in props}


def linked_packages(yaml: str) -> set[str]:
    """The package names that targets link with `- package: Name`."""
    return set(re.findall(r"^\s*-\s*package:\s*['\"]?([\w.-]+)", yaml, re.M))


def mirror_pins(manifest: str) -> list[tuple[str, str]]:
    """The `.package(url: "...", exact: "...")` requirements of a Package.swift, as (url, version)."""
    return re.findall(r'\.package\(\s*url:\s*"([^"]+)"\s*,\s*exact:\s*"([^"]+)"', manifest)


def problems(yaml: str, manifest: str | None, allowed: set[str], spec: str = "project.yml", mirror: str = "mirror") -> list[str]:
    found: list[str] = []
    packages = remote_packages(yaml)
    pinned: dict[str, tuple[str, str]] = {}
    for name, props in sorted(packages.items()):
        fixed = next((props[key] for key in FIXED_KEYS if key in props), None)
        ranged = [key for key in RANGE_KEYS if key in props]
        if fixed and not ranged:
            pinned[name] = (props["url"], fixed)
        elif name not in allowed:
            how = ", ".join(f"{key}: {props[key]}" for key in ranged) or "no version"
            found.append(f"{spec}: package {name} uses {how}; pin it with exactVersion (or --allow {name})")
    if manifest is None:
        return found
    linked = linked_packages(yaml)
    by_url = {normalize_url(url): (name, version) for name, (url, version) in pinned.items()}
    mirrored = set()
    for url, version in mirror_pins(manifest):
        mirrored.add(normalize_url(url))
        match = by_url.get(normalize_url(url))
        if match is None:
            found.append(f"{mirror} pins {url}, which {spec} does not pin with an exact version")
        elif match[1] != version:
            found.append(f"{url} is {version} in {mirror} and {match[1]} in {spec} ({match[0]}): make them the same")
    for name, (url, _) in sorted(pinned.items()):
        if name in linked and normalize_url(url) not in mirrored:
            found.append(f"{spec} links {name} ({url}), which {mirror} does not pin, so Dependabot cannot update it")
    return found


SAMPLE_YAML = """\
name: App
packages:
  Exact:
    url: https://example.com/org/exact.git
    exactVersion: 1.2.3
  Ranged:
    url: https://example.com/org/ranged
    from: "2.0.0"
  Local:
    path: ../Packages/AppKit
  Flow: { url: "https://example.com/org/flow", exactVersion: 0.9.0 }
  FlowLocal: { path: Packages/Other }
targets:
  App:
    dependencies:
      - package: Exact
      - package: Ranged
      - package: Local
"""


def self_test() -> int:
    assert set(remote_packages(SAMPLE_YAML)) == {"Exact", "Ranged", "Flow"}
    assert remote_packages(SAMPLE_YAML)["Flow"]["exactVersion"] == "0.9.0"
    assert linked_packages(SAMPLE_YAML) == {"Exact", "Ranged", "Local"}
    errors = problems(SAMPLE_YAML, None, set())
    assert len(errors) == 1 and "Ranged uses from: 2.0.0" in errors[0], errors
    assert problems(SAMPLE_YAML, None, {"Ranged"}) == []
    good = '.package(url: "https://example.com/org/exact", exact: "1.2.3")'
    assert problems(SAMPLE_YAML, good, {"Ranged"}) == []
    stale = problems(SAMPLE_YAML, good.replace("1.2.3", "1.3.0"), {"Ranged"})
    assert len(stale) == 1 and "1.3.0" in stale[0], stale
    missing = problems(SAMPLE_YAML, "", {"Ranged"})
    assert len(missing) == 1 and "does not pin" in missing[0], missing
    extra = problems(SAMPLE_YAML, good + '\n.package(url: "https://example.com/x", exact: "1.0.0")', {"Ranged"})
    assert len(extra) == 1 and "example.com/x" in extra[0], extra
    print("check-vendor-pins self-test: ok")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--spec", default="project.yml", help="the XcodeGen spec (default: project.yml)")
    parser.add_argument("--mirror", help="a Package.swift that repeats the pins for Dependabot")
    parser.add_argument("--allow", action="append", default=[], help="a package that may use a range")
    parser.add_argument("--self-test", action="store_true", help="run the built-in tests")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    spec = Path(args.spec)
    if not spec.is_file():
        print(f"not found: {spec}", file=sys.stderr)
        return 2
    manifest = Path(args.mirror).read_text() if args.mirror else None
    found = problems(spec.read_text(), manifest, set(args.allow), str(spec), args.mirror or "mirror")
    for line in found:
        print(f"error: {line}", file=sys.stderr)
    if not found:
        print(f"vendor pins: every remote package in {spec} is pinned" + (f" and matches {args.mirror}" if manifest is not None else ""))
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
