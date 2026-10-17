#!/usr/bin/env python3
"""Registers Lift's App IDs and capabilities through the App Store Connect API, and reports what is still missing.

Idempotent: anything that already exists is left alone. Needs no Python packages: the ES256 token is signed with the
openssl CLI. Inputs come from the environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 contents) and BUNDLE_ID.

What the API cannot do (Apple does not offer it): create the App Store Connect app record, and register or assign an
App Group. Automatic signing in the TestFlight archive registers and assigns the group; the app record is one tap in
App Store Connect once the App ID below exists.
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.appstoreconnect.apple.com/v1"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """openssl writes ECDSA signatures as DER SEQUENCE{INTEGER r, INTEGER s}; JWS wants r || s, 32 bytes each."""
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
    claims = {"iss": issuer, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"}
    payload = b64url(json.dumps(claims).encode())
    signing_input = f"{header}.{payload}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".p8", delete=False) as handle:
        handle.write(key_pem.strip() + "\n")
        key_path = handle.name
    try:
        os.chmod(key_path, 0o600)
        der = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input,
            capture_output=True,
            check=True,
        ).stdout
    finally:
        os.remove(key_path)
    return f"{header}.{payload}.{b64url(der_to_raw(der))}"


class Client:
    def __init__(self, bearer: str):
        self.bearer = bearer

    def call(self, method: str, path: str, body: dict | None = None) -> dict:
        request = urllib.request.Request(
            API + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {self.bearer}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                text = response.read().decode()
                return json.loads(text) if text else {}
        except urllib.error.HTTPError as error:
            detail = error.read().decode()
            raise SystemExit(f"App Store Connect {method} {path} failed with HTTP {error.code}: {detail}") from None

    def bundle_id(self, identifier: str) -> dict | None:
        query = urllib.parse.urlencode({"filter[identifier]": identifier, "limit": 200})
        for item in self.call("GET", f"/bundleIds?{query}").get("data", []):
            if item["attributes"]["identifier"] == identifier:
                return item
        return None

    def ensure_bundle_id(self, identifier: str, name: str) -> str:
        existing = self.bundle_id(identifier)
        if existing:
            print(f"✓ App ID {identifier} already registered")
            return existing["id"]
        body = {"data": {"type": "bundleIds", "attributes": {"identifier": identifier, "name": name, "platform": "IOS"}}}
        created = self.call("POST", "/bundleIds", body)["data"]
        print(f"+ Registered App ID {identifier}")
        return created["id"]

    def ensure_capability(self, bundle_resource: str, identifier: str, capability: str) -> None:
        current = self.call("GET", f"/bundleIds/{bundle_resource}/bundleIdCapabilities").get("data", [])
        if any(item["attributes"]["capabilityType"] == capability for item in current):
            print(f"✓ {capability} already on {identifier}")
            return
        body = {
            "data": {
                "type": "bundleIdCapabilities",
                "attributes": {"capabilityType": capability},
                "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bundle_resource}}},
            }
        }
        self.call("POST", "/bundleIdCapabilities", body)
        print(f"+ Turned on {capability} for {identifier}")

    def app_exists(self, identifier: str) -> bool:
        query = urllib.parse.urlencode({"filter[bundleId]": identifier})
        return any(item["attributes"]["bundleId"] == identifier for item in self.call("GET", f"/apps?{query}").get("data", []))


def main() -> int:
    names = ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8", "BUNDLE_ID"]
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        print(f"::error::Missing {' '.join(missing)} (see lift/DEFERRED.md).")
        return 1
    bundle = os.environ["BUNDLE_ID"]
    client = Client(token(os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["ASC_KEY_P8"]))

    targets = [
        (bundle, "Lift", ["APP_GROUPS", "HEALTHKIT"]),
        (f"{bundle}.widgets", "Lift Widgets", ["APP_GROUPS"]),
        (f"{bundle}.share", "Lift Share", ["APP_GROUPS"]),
    ]
    for identifier, name, capabilities in targets:
        resource = client.ensure_bundle_id(identifier, name)
        for capability in capabilities:
            client.ensure_capability(resource, identifier, capability)

    if client.app_exists(bundle):
        print(f"✓ App Store Connect app record for {bundle} exists")
        print("Ready: run the TestFlight workflow.")
    else:
        print(f"::warning::No App Store Connect app yet. Create it: App Store Connect → Apps → + → New App, bundle ID {bundle}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
