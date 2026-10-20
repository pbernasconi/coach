#!/usr/bin/env python3
"""Revokes the Apple Development certificates that CI runners made ("Created via API").

The TestFlight workflow imports one stored certificate (secret LIFT_CERT_P12, id in variable LIFT_CERT_ID), so a
run does not make a new one. If that certificate is missing or expired, automatic signing makes a new development
certificate on the runner, and the runner's private key is gone when the job ends. Apple allows only a few
certificates per account, so the archive then fails after some runs. This script removes those leftovers before
each archive, and keeps the stored certificate.

Certificates made in Xcode on a Mac carry the Mac's name, not "Created via API", so this script leaves them alone.
Inputs come from the environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 contents) and LIFT_CERT_ID.
"""

import importlib.util
import os
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("asc_setup", Path(__file__).with_name("asc-setup.py"))
assert spec and spec.loader
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)

CI_NAME = "Created via API"


def main() -> int:
    client = asc.Client(asc.token(os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["ASC_KEY_P8"]))
    certificates = client.call("GET", "/certificates?limit=200&filter[certificateType]=DEVELOPMENT").get("data", [])
    keep = os.environ.get("LIFT_CERT_ID", "")
    stale = [
        item for item in certificates if item["attributes"].get("displayName") == CI_NAME and item["id"] != keep
    ]
    for item in stale:
        client.call("DELETE", f"/certificates/{item['id']}")
        print(f"- Revoked CI development certificate {item['id']}")
    print(f"✓ {len(stale)} CI certificates revoked, {len(certificates) - len(stale)} other development certificates kept")
    return 0


if __name__ == "__main__":
    sys.exit(main())
