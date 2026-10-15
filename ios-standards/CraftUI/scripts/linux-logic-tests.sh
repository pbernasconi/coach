#!/usr/bin/env bash
# linux-logic-tests.sh: build and run CraftUI's pure logic and its tests on Linux, where SwiftUI is missing.
#
# Every SwiftUI-free source file (maths, state machines, models) and every test that only touches those is
# linked into a throwaway package with the same module names and strict settings as Package.swift. Runs in CI
# on ubuntu-latest and in agent sandboxes, so logic is compiled and tested before anyone opens Xcode.
#   scripts/linux-logic-tests.sh            # build + test into $TMPDIR
#   KEEP=dir scripts/linux-logic-tests.sh   # reuse a build directory between runs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${KEEP:-$(mktemp -d)}"
rm -rf "$WORK/Sources" "$WORK/Tests"

link_module() { # kind(Sources|Tests) module
  local kind="$1" module="$2" f
  mkdir -p "$WORK/$kind/$module"
  [ -d "$ROOT/$kind/$module" ] || return 0
  while IFS= read -r f; do
    ln -s "$f" "$WORK/$kind/$module/$(basename "$f")"
  done < <(grep -rL 'import SwiftUI' --include='*.swift' "$ROOT/$kind/$module" || true)
}
for m in CraftTokens CraftComponents CraftPatterns CraftCatalog; do link_module Sources "$m"; done
for m in CraftComponentsTests CraftPatternsTests CraftCatalogTests; do link_module Tests "$m"; done

# Linux stand-ins for the two token types whose declarations live in SwiftUI files.
cat >"$WORK/Sources/CraftTokens/LinuxStandIns.swift" <<'SWIFT'
public enum Tone: String, Sendable, CaseIterable { case neutral, accent, success, warning, danger, info }
public enum Motion {}
SWIFT
# Foundation on Linux has no interpolated String(localized:); keep the text, drop the lookup.
while IFS= read -r f; do
  src="$(readlink "$f")"; rm "$f"
  sed 's/String(localized: \("[^"]*"\))/\1/g' "$src" >"$f"
done < <(grep -Rl 'String(localized:' "$WORK/Sources" || true)

# Same targets and strict settings as the real manifest, minus platforms and the SwiftUI-only token tests.
sed -e 's/platforms: \[[^]]*\],//' -e '/name: "CraftTokensTests"/d' "$ROOT/Package.swift" >"$WORK/Package.swift"

cd "$WORK"
set +e
swift test >"$WORK/test.log" 2>&1
status=$?
set -e
grep -E '✘|recorded an issue|error:|warning:|Test run with' "$WORK/test.log" | sort -u || true
[ "$status" -eq 0 ] && echo "linux-logic-tests: passed" || echo "linux-logic-tests: FAILED (full log: $WORK/test.log)" >&2
exit "$status"
