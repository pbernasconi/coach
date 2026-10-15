#!/usr/bin/env bash
# Prints the UDID of an available iPhone simulator (newest runtime, Pro model preferred). Used by CI.
set -euo pipefail
xcrun simctl list devices available -j | python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    return [int(n) for n in re.findall(r"\d+", runtime.split("iOS")[-1])]
best = None
for runtime, items in devices.items():
    if "iOS" not in runtime:
        continue
    for d in items:
        if not d["name"].startswith("iPhone"):
            continue
        key = (version(runtime), "Pro" in d["name"] and "Max" not in d["name"])
        if best is None or key > best[0]:
            best = (key, d["udid"])
if best is None:
    sys.exit("no iPhone simulator available")
print(best[1])
'
