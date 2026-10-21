#!/usr/bin/env python3
"""Lists, and with --apply revokes, the Apple Development certificates that CI runners made through the API.

    scripts/asc-revoke-ci-certs.py            # dry run: print what it would revoke
    scripts/asc-revoke-ci-certs.py --apply    # revoke them

Why: with automatic signing and an App Store Connect API key, a CI runner that has no development certificate
asks Apple for a new one, and the runner's private key is gone when the job ends. Apple allows only a few
development certificates per account, so after some runs the archive fails. The fix is to store one
certificate (a .p12 in a CI secret) and import it before each build. This script removes the leftovers.

Certificates that Xcode made on a Mac carry the Mac's name; certificates made through the API are named
"Created via API". The script only touches the second kind, and never the ids in ASC_KEEP_CERT_IDS: the stored
CI certificate, and any Mac that signs with the same API key (its certificate is also "Created via API").

Environment: ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_P8 (the .p8 contents) or ASC_KEY_PATH (the .p8 file);
ASC_KEEP_CERT_IDS: certificate ids to keep, separated by commas.
Needs only the Python 3.9+ standard library and the openssl command (it signs the ES256 token).
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

API = "https://api.appstoreconnect.apple.com/v1"
CI_NAME = "Created via API"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """openssl writes an ECDSA signature as DER SEQUENCE{INTEGER r, INTEGER s}; JWS wants r || s, 32 bytes each."""
    if der[0] != 0x30:
        raise ValueError("unexpected signature encoding")
    index = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    parts = []
    for _ in range(2):
        if der[index] != 0x02:
            raise ValueError("unexpected signature encoding")
        length = der[index + 1]
        value = der[index + 2 : index + 2 + length].lstrip(b"\x00")
        parts.append(value.rjust(32, b"\x00"))
        index += 2 + length
    return parts[0] + parts[1]


def token(key_id: str, issuer: str, key_pem: str) -> str:
    header = b64url(json.dumps({"alg": "ES256", "kid": key_id, "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64url(json.dumps({"iss": issuer, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"}).encode())
    signing_input = f"{header}.{payload}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".p8", delete=False) as handle:
        handle.write(key_pem.strip() + "\n")
        key_path = handle.name
    try:
        os.chmod(key_path, 0o600)
        der = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path], input=signing_input, capture_output=True, check=True
        ).stdout
    finally:
        os.remove(key_path)
    return f"{header}.{payload}.{b64url(der_to_raw(der))}"


def call(bearer: str, method: str, path: str) -> dict:
    request = urllib.request.Request(API + path, method=method, headers={"Authorization": f"Bearer {bearer}"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {path}: HTTP {error.code}: {error.read().decode(errors='replace')[:500]}")
    return json.loads(body) if body else {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="revoke the certificates (default: dry run)")
    args = parser.parse_args()
    missing = [name for name in ("ASC_KEY_ID", "ASC_ISSUER_ID") if not os.environ.get(name)]
    key_pem = os.environ.get("ASC_KEY_P8", "")
    if not key_pem and os.environ.get("ASC_KEY_PATH"):
        with open(os.environ["ASC_KEY_PATH"], encoding="utf-8") as handle:
            key_pem = handle.read()
    if not key_pem:
        missing.append("ASC_KEY_P8 or ASC_KEY_PATH")
    if missing:
        sys.exit(f"missing: {', '.join(missing)}")

    bearer = token(os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], key_pem)
    certificates = call(bearer, "GET", "/certificates?limit=200&filter[certificateType]=DEVELOPMENT").get("data", [])
    keep = {cert_id.strip() for cert_id in os.environ.get("ASC_KEEP_CERT_IDS", "").split(",") if cert_id.strip()}
    stale = [item for item in certificates if item["attributes"].get("displayName") == CI_NAME and item["id"] not in keep]
    for item in stale:
        expires = item["attributes"].get("expirationDate", "?")
        if args.apply:
            call(bearer, "DELETE", f"/certificates/{item['id']}")
            print(f"revoked {item['id']} (expires {expires})")
        else:
            print(f"would revoke {item['id']} (expires {expires})")
    verb = "revoked" if args.apply else "to revoke (dry run; --apply revokes)"
    print(f"{len(stale)} CI certificates {verb}; {len(certificates) - len(stale)} other development certificates kept")
    return 0


if __name__ == "__main__":
    sys.exit(main())
