# Passes the OTA password to espota for `pio run -e atoms3-ota -t upload`. It comes from the SCALE_OTA_PASSWORD
# environment variable or, without it, OTA_PASSWORD in include/config.h, so it never sits in a tracked file.
import os
import re

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
