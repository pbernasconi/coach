#!/usr/bin/env bash
# The complete static-analysis suite. Same command locally, in CI and in an agent session.
#   scripts/lint-all.sh            run every check (continues past failures, exits 1 if any failed)
#   scripts/lint-all.sh --fix      auto-fix what can be fixed (swift-format, swiftlint --fix), then check
#   scripts/lint-all.sh --deep     also run macOS-only checks: XcodeGen build with warnings-as-errors, Periphery
# Tools come from ./.tools (scripts/install-tools.sh); Swift from PATH.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
TOOLS="${TOOLS_DIR:-$ROOT/.tools}"
PATH="$TOOLS/bin:$TOOLS/venv/bin:$TOOLS/node/node_modules/.bin:$PATH"
# SwiftLint on Linux loads SourceKit from the Swift toolchain.
if [ "$(uname)" = "Linux" ] && [ -z "${LINUX_SOURCEKIT_LIB_PATH:-}" ] && command -v swiftc >/dev/null 2>&1; then
  LINUX_SOURCEKIT_LIB_PATH="$(cd "$(dirname "$(command -v swiftc)")/../lib" && pwd)"
  export LINUX_SOURCEKIT_LIB_PATH
fi
FIX=0; DEEP=0
for a in "$@"; do case "$a" in --fix) FIX=1 ;; --deep) DEEP=1 ;; esac; done

failed=(); skipped=()
step() { # name, command...
  local name="$1"; shift
  printf '\n▸ %s\n' "$name"
  if "$@"; then printf '  ✓ %s\n' "$name"; else printf '  ✗ %s\n' "$name"; failed+=("$name"); fi
}
skip() { printf '\n▸ %s\n  – skipped: %s\n' "$1" "$2"; skipped+=("$1"); }
have() { command -v "$1" >/dev/null 2>&1; }

mapfile -t SWIFT_FILES < <(git ls-files --cached --others --exclude-standard '*.swift' 2>/dev/null || find . -name '*.swift' -not -path './.tools/*')
mapfile -t SH_FILES < <(git ls-files --cached --others --exclude-standard '*.sh' 2>/dev/null)
mapfile -t YAML_FILES < <(git ls-files --cached --others --exclude-standard '*.yml' '*.yaml' 2>/dev/null)
mapfile -t WF_FILES < <(printf '%s\n' "${YAML_FILES[@]}" | grep -E '\.github/workflows/' || true)

# 1. Our own bans (no build needed).
step "ios-guard (banned APIs, sizes, names)" scripts/ios-guard.sh "${SWIFT_FILES[@]}"

# 2. Swift syntax: every file must parse with the pinned toolchain, even where SwiftUI can't compile (Linux).
parse_all() { local ok=0 f; for f in "${SWIFT_FILES[@]}"; do swiftc -parse "$f" || ok=1; done; return $ok; }
if have swiftc; then step "swift syntax (swiftc -parse)" parse_all; else skip "swift syntax" "no swiftc on PATH"; fi

# 3. Formatting (Apple swift-format, bundled with the toolchain).
FMT_CFG=".swift-format"; [ -f "$FMT_CFG" ] || FMT_CFG="templates/config/.swift-format"
if have swift && swift format --version >/dev/null 2>&1; then
  [ "$FIX" = 1 ] && swift format format -i --configuration "$FMT_CFG" "${SWIFT_FILES[@]}"
  step "swift-format (strict)" swift format lint --strict --configuration "$FMT_CFG" "${SWIFT_FILES[@]}"
else skip "swift-format" "swift toolchain missing"; fi

# 4. SwiftLint (correctness + size rules).
LINT_CFG=".swiftlint.yml"; [ -f "$LINT_CFG" ] || LINT_CFG="templates/config/.swiftlint.yml"
if have swiftlint; then
  [ "$FIX" = 1 ] && swiftlint --fix --config "$LINT_CFG" --quiet "${SWIFT_FILES[@]}"
  step "swiftlint (strict)" swiftlint lint --strict --quiet --config "$LINT_CFG" "${SWIFT_FILES[@]}"
else skip "swiftlint" "run scripts/install-tools.sh --swiftlint"; fi

# 4b. Package-specific checks: any package may ship scripts/catalog-coverage.sh (every public view is in its
#     catalog) and scripts/linux-logic-tests.sh (its SwiftUI-free logic and tests, built and run on Linux).
while IFS= read -r check; do
  step "$(basename "$(dirname "$(dirname "$check")")") catalog coverage" "$check"
done < <(find . -path ./.tools -prune -o -path '*/scripts/catalog-coverage.sh' -print)
if [ "$(uname)" = "Linux" ] && have swift; then
  while IFS= read -r check; do
    step "$(basename "$(dirname "$(dirname "$check")")") logic tests (Linux)" "$check"
  done < <(find . -path ./.tools -prune -o -path '*/scripts/linux-logic-tests.sh' -print)
fi

# 5. Shell scripts.
if have shellcheck && [ "${#SH_FILES[@]}" -gt 0 ]; then step "shellcheck" shellcheck -x "${SH_FILES[@]}"; else skip "shellcheck" "no tool or no scripts"; fi

# 6. GitHub Actions: correctness (actionlint) and security (zizmor).
if [ "${#WF_FILES[@]}" -gt 0 ]; then
  if have actionlint; then step "actionlint" actionlint "${WF_FILES[@]}"; else skip "actionlint" "not installed"; fi
  if have zizmor; then step "zizmor (workflow security)" zizmor --offline --min-severity low "${WF_FILES[@]}"; else skip "zizmor" "not installed"; fi
fi

# 7. YAML (project.yml, lint configs, workflows).
if have yamllint && [ "${#YAML_FILES[@]}" -gt 0 ]; then step "yamllint" yamllint --strict "${YAML_FILES[@]}"; else skip "yamllint" "not installed"; fi

# 8. Markdown docs.
if have markdownlint-cli2; then step "markdownlint" markdownlint-cli2 "**/*.md" "#.tools" "#**/node_modules" "#**/.build"; else skip "markdownlint" "not installed"; fi

# 9. Spelling in code, comments and docs.
if have typos; then step "typos" typos; else skip "typos" "not installed"; fi

# 10. Secrets.
if have detect-secrets; then
  scan_secrets() { local files; mapfile -t files < <(git ls-files); detect-secrets-hook --baseline .secrets.baseline "${files[@]}"; }
  [ -f .secrets.baseline ] || detect-secrets scan --exclude-files '\.tools/' > .secrets.baseline
  step "detect-secrets" scan_secrets
else skip "detect-secrets" "not installed"; fi

# 11. macOS-only deep checks.
if [ "$DEEP" = 1 ]; then
  if [ "$(uname)" = "Darwin" ]; then
    [ -f project.yml ] && step "xcodegen + build (warnings as errors)" bash -c 'xcodegen generate --quiet && xcodebuild build -scheme App -destination "generic/platform=iOS Simulator" SWIFT_TREAT_WARNINGS_AS_ERRORS=YES > .build-log.txt'
    [ -f .build-log.txt ] && have swiftlint && step "swiftlint analyze (unused imports/declarations)" swiftlint analyze --strict --quiet --config "$LINT_CFG" --compiler-log-path .build-log.txt
    if have periphery; then step "periphery (dead code)" periphery scan --strict --quiet; else skip "periphery" "brew install periphery"; fi
  else skip "deep checks" "macOS only"; fi
fi

printf '\n%s\n' "────────────────────────────────"
[ "${#skipped[@]}" -gt 0 ] && printf 'skipped: %s\n' "${skipped[*]}"
if [ "${#failed[@]}" -gt 0 ]; then printf 'FAILED: %s\n' "${failed[*]}"; exit 1; fi
echo "all checks passed"
