#!/usr/bin/env bash
# One lint entry point, identical locally and in CI (TOOL-2).
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/ios-guard.sh
swift-format lint --strict --recursive --configuration .swift-format App AppWidgets Packages
swiftlint lint --strict --quiet
