#!/usr/bin/env python3
"""Reports what App Store Connect did with Lift's recent TestFlight uploads.

An upload that succeeds can still fail Apple's processing, or wait on export compliance, and then never reaches
TestFlight. This prints each recent build with its processing state, its TestFlight state for internal testers and
the internal groups it is in, and exits 1 when a build is invalid or stuck.

    asc-builds.py                 the last 5 builds
    asc-builds.py --wait 36       wait (up to 30 minutes) until build 36 has finished processing, then report

Inputs come from the environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 contents) and BUNDLE_ID.
"""

import argparse
import importlib.util
import os
import sys
import time
import urllib.parse
from pathlib import Path

spec = importlib.util.spec_from_file_location("asc_setup", Path(__file__).with_name("asc-setup.py"))
assert spec and spec.loader
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)

# buildBetaDetails.internalBuildState values that mean the build will not reach internal testers on its own.
BLOCKED = {"MISSING_EXPORT_COMPLIANCE", "PROCESSING_EXCEPTION", "EXPIRED", "BETA_REJECTED"}
WAIT_SECONDS = 30 * 60


def client() -> "asc.Client":
    return asc.Client(asc.token(os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["ASC_KEY_P8"]))


def app_id(api: "asc.Client", bundle: str) -> str:
    apps = api.call("GET", "/apps?limit=50").get("data", [])
    for item in apps:
        attributes = item["attributes"]
        print(f"app {attributes.get('name')!r} · {attributes.get('bundleId')} · id {item['id']}")
    for item in apps:
        if item["attributes"]["bundleId"] == bundle:
            return item["id"]
    raise SystemExit(f"::error::No App Store Connect app for {bundle}.")


def builds(api: "asc.Client", app: str, version: str | None, limit: int) -> list[dict]:
    params = {
        "filter[app]": app,
        "sort": "-uploadedDate",
        "limit": limit,
        "include": "buildBetaDetail,betaGroups",
        "fields[betaGroups]": "name,isInternalGroup",
    }
    if version:
        params["filter[version]"] = version
    response = api.call("GET", f"/builds?{urllib.parse.urlencode(params)}")
    included = {(item["type"], item["id"]): item for item in response.get("included", [])}
    rows = []
    for build in response.get("data", []):
        attributes = build["attributes"]
        relations = build.get("relationships", {})
        detail_ref = (relations.get("buildBetaDetail") or {}).get("data")
        detail = included.get((detail_ref["type"], detail_ref["id"]), {}) if detail_ref else {}
        groups = [
            included.get((ref["type"], ref["id"]), {}).get("attributes", {}).get("name", "?")
            for ref in (relations.get("betaGroups") or {}).get("data") or []
        ]
        rows.append(
            {
                "version": attributes.get("version"),
                "uploaded": attributes.get("uploadedDate"),
                "processing": attributes.get("processingState"),
                "expired": attributes.get("expired"),
                "encryption": attributes.get("usesNonExemptEncryption"),
                "internal": detail.get("attributes", {}).get("internalBuildState"),
                "groups": groups,
            }
        )
    return rows


def problem(row: dict) -> str | None:
    if row["processing"] in {"FAILED", "INVALID"}:
        return f"Apple's processing marked it {row['processing']} (Apple emails the reason to the account holder)"
    if row["internal"] in BLOCKED:
        return f"TestFlight state {row['internal']}"
    if row["expired"]:
        return "expired"
    return None


def report(rows: list[dict]) -> int:
    failures = 0
    for row in rows:
        issue = problem(row)
        failures += issue is not None
        groups = ", ".join(row["groups"]) or "no groups"
        line = (
            f"build {row['version']} · uploaded {row['uploaded']} · processing {row['processing']} · "
            f"TestFlight {row['internal']} · {groups} · non-exempt encryption {row['encryption']}"
        )
        print(f"::error::{line} · {issue}" if issue else f"✓ {line}")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wait", metavar="BUILD", help="wait until this build number has finished processing")
    args = parser.parse_args()
    api = client()
    app = app_id(api, os.environ.get("BUNDLE_ID") or "com.pbernasconi.lift")
    if not args.wait:
        return report(builds(api, app, None, 5))

    deadline = time.monotonic() + WAIT_SECONDS
    while True:
        rows = builds(api, app, args.wait, 1)
        state = rows[0]["processing"] if rows else "NOT_LISTED_YET"
        if state not in {"PROCESSING", "NOT_LISTED_YET"}:
            return report(rows)
        if time.monotonic() > deadline:
            print(f"::error::Build {args.wait} is still {state} after {WAIT_SECONDS // 60} minutes.")
            return 1
        print(f"… build {args.wait} is {state}")
        time.sleep(60)
        api = client()  # tokens last 20 minutes


if __name__ == "__main__":
    sys.exit(main())
