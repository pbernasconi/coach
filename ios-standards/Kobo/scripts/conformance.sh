#!/usr/bin/env bash
# conformance.sh: check Kobo components against CONVENTIONS.md (see conformance.py for the rules).
set -euo pipefail
exec python3 "$(dirname "$0")/conformance.py" "$@"
