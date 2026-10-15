#!/usr/bin/env bash
# CI's xcodebuild for the Lift scheme on a simulator. Both CI app jobs call it with the same settings, so they
# share one compilation cache: Xcode's content-addressed cache (COMPILATION_CACHE_ENABLE_CACHING) lives in
# build/cas and the SwiftPM checkouts in build/spm, both saved and restored with actions/cache.
#   scripts/ci-xcodebuild.sh <log file> <xcodebuild action…>   e.g. build-for-testing, test-without-building
# Needs SIM_UDID (scripts/simulator.sh). Prints the log's tail and its unique errors; exits with xcodebuild's
# status.
set -euo pipefail
LOG="$PWD/$1"
shift
cd "$(dirname "$0")/.."
ROOT="$(cd ../.. && pwd)"
status=0
xcodebuild "$@" \
  -project Lift.xcodeproj \
  -scheme Lift \
  -destination "id=$SIM_UDID" \
  -derivedDataPath "$ROOT/build/lift" \
  -clonedSourcePackagesDirPath "$ROOT/build/spm" \
  -skipMacroValidation \
  -skipPackagePluginValidation \
  -showBuildTimingSummary \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  ONLY_ACTIVE_ARCH=YES \
  COMPILATION_CACHE_ENABLE_CACHING=YES \
  COMPILATION_CACHE_CAS_PATH="$ROOT/build/cas" \
  >"$LOG" 2>&1 || status=$?
tail -n 60 "$LOG"
echo "::group::Unique errors ($*)"
grep -E "(error|warning):|✘|recorded an issue|\*\* (BUILD|TEST)[A-Z ]* " "$LOG" | grep -v "^ *|" | sort -u | head -n 150 || true
echo "::endgroup::"
exit "$status"
