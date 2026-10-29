# Over-the-air updates (`pio run -e atoms3-ota -t upload`):
# - passes the OTA password to espota: SCALE_OTA_PASSWORD, or OTA_PASSWORD in include/config.h, so it never sits in
#   a tracked file;
# - turns scale-bridge.local into an IP address first. espota's own lookup often fails on macOS ("Host
#   scale-bridge.local Not Found") although the name works in a browser. SCALE_BRIDGE_IP skips the lookup.
import os
import re
import shutil
import socket
import subprocess

Import("env")  # noqa: F821 (PlatformIO's SCons global)

if env.subst("$UPLOAD_PROTOCOL") == "espota":  # noqa: F821
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
        try:
            return socket.getaddrinfo(host, 3232, socket.AF_INET)[0][4][0]
        except OSError:
            pass
        # macOS: ask mDNSResponder directly.
        if shutil.which("dscacheutil"):
            try:
                out = subprocess.run(["dscacheutil", "-q", "host", "-a", "name", host], capture_output=True, text=True, timeout=5).stdout
                m = re.search(r"ip_address:\s*(\d+\.\d+\.\d+\.\d+)", out)
                if m:
                    return m.group(1)
            except Exception:
                pass
        return None

    port = os.environ.get("SCALE_BRIDGE_IP") or env.subst("$UPLOAD_PORT")  # noqa: F821
    if port.endswith(".local"):
        ip = resolve(port)
        if ip:
            print(f"ota_auth.py: {port} is {ip}")
            port = ip
        else:
            print(f"ota_auth.py: could not resolve {port}; pass --upload-port <the board's IP> (on the status page)")
    env.Replace(UPLOAD_PORT=port)  # noqa: F821
