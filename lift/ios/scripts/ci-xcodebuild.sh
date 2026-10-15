#!/usr/bin/env bash
# CI's xcodebuild for Lift, in two halves that run in different jobs:
#   scripts/ci-xcodebuild.sh build <log>              build-for-testing for any arm64 simulator, with Xcode's
#                                                     compilation cache in build/cas (CI saves and restores it)
#   scripts/ci-xcodebuild.sh test <log> <xctestrun>   test-without-building on the simulator SIM_UDID, from
#                                                     products the build job made
# Log lines get a UTC time stamp. Prints the log's tail and its unique errors; exits with xcodebuild's status.
set -euo pipefail
MODE="$1"
LOG="$PWD/$2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
case "$MODE" in
  build)
    args=(build-for-testing
      -project "$ROOT/lift/ios/Lift.xcodeproj"
      -scheme Lift
      -destination "generic/platform=iOS Simulator"
      -derivedDataPath "$ROOT/build/lift"
      -clonedSourcePackagesDirPath "$ROOT/build/spm"
      -skipMacroValidation
      -skipPackagePluginValidation
      -showBuildTimingSummary
      -enableCodeCoverage NO
      ARCHS=arm64
      ONLY_ACTIVE_ARCH=YES
      CODE_SIGNING_ALLOWED=NO
      COMPILER_INDEX_STORE_ENABLE=NO
      COMPILATION_CACHE_ENABLE_CACHING=YES
      COMPILATION_CACHE_CAS_PATH="$ROOT/build/cas")
    ;;
  test)
    args=(test-without-building
      -xctestrun "$3"
      -destination "id=$SIM_UDID"
      -parallel-testing-enabled NO)
    ;;
  *) echo "usage: $0 build|test <log> [xctestrun]" >&2 && exit 2 ;;
esac
status=0
xcodebuild "${args[@]}" 2>&1 | perl -MPOSIX -ne 'print strftime("%H:%M:%S ", gmtime), $_' >"$LOG" || status=$?
tail -n 40 "$LOG"
echo "::group::Unique errors ($MODE)"
grep -E "(error|warning):|✘|recorded an issue|\*\* (BUILD|TEST)[A-Z ]* " "$LOG" | grep -v "^[0-9:]* *|" | sort -u | head -n 150 || true
echo "::endgroup::"
exit "$status"
