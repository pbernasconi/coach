#!/usr/bin/env bash
# Regenerate Lift.xcodeproj from project.yml (LAY-1). Never edit the .xcodeproj by hand.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v xcodegen >/dev/null || { echo "xcodegen not found: brew install xcodegen" >&2; exit 1; }
xcodegen generate --quiet --spec project.yml
