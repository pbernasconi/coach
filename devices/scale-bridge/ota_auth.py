# Over-the-air upload helper for `pio run -e atoms3-ota -t upload`:
# 1. Passes the OTA password to espota. It comes from the SCALE_OTA_PASSWORD environment variable or, without it,
#    OTA_PASSWORD in include/config.h, so it never sits in a tracked file.
# 2. Turns scale-bridge.local into an IP address first. espota's own lookup of .local names fails often on macOS
#    ("Host scale-bridge.local Not Found"); SCALE_BRIDGE_IP or `--upload-port <ip>` skip the lookup.
import os
import re
import socket
import subprocess
import time

Import("env")  # noqa: F821 (PlatformIO's SCons global)

password = os.environ.get("SCALE_OTA_PASSWORD")
if not password:
    config = os.path.join(env.subst("$PROJECT_DIR"), "include", "config.h")  # noqa: F821
    try:
        with open(config, encoding="utf-8") as f:
            m = re.search(r'^\s*#define\s+OTA_PASSWORD\s+"((?:[^"\\]|\\.)*)"', f.read(), re.M)
        password = m.group(1).encode().decode("unicode_escape") if m else None
    except OSError:
        password = None

if password:
    env.Append(UPLOADERFLAGS=["--auth=" + password])  # noqa: F821
else:
    print("ota_auth.py: no OTA password (set OTA_PASSWORD in include/config.h); the board will refuse the update")


def resolve(host):
    for _ in range(5):
        try:
            return socket.getaddrinfo(host, 3232, socket.AF_INET)[0][4][0]
        except OSError:
            pass
        try:  # macOS: ask mDNSResponder directly
            out = subprocess.run(["dscacheutil", "-q", "host", "-a", "name", host], capture_output=True, text=True,
                                 timeout=5).stdout
            m = re.search(r"^ip_address:\s*(\d+\.\d+\.\d+\.\d+)", out, re.M)
            if m:
                return m.group(1)
        except (OSError, subprocess.SubprocessError):
            pass
        time.sleep(1)
    return None


port = os.environ.get("SCALE_BRIDGE_IP") or env.subst("$UPLOAD_PORT")  # noqa: F821
if port and not re.fullmatch(r"\d+\.\d+\.\d+\.\d+", port):
    ip = resolve(port)
    if ip:
        print(f"ota_auth.py: {port} is {ip}")
        port = ip
    else:
        print(f"ota_auth.py: could not find {port}; pass --upload-port <ip> (the bridge's status page shows it)")
if port:
    env.Replace(UPLOAD_PORT=port)  # noqa: F821
