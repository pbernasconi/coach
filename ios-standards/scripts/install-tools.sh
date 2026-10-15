#!/usr/bin/env bash
# Installs every pinned lint tool into ./.tools (gitignored). Works on macOS and Linux, needs only
# python3, node and git. Swift itself comes from Xcode (macOS) or a swift.org toolchain (Linux).
#   scripts/install-tools.sh            # Python + Node tools
#   scripts/install-tools.sh --swiftlint  # also build SwiftLint from source (Linux; macOS can use brew)
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=/dev/null
source scripts/tools.lock
TOOLS="${TOOLS_DIR:-$PWD/.tools}"
mkdir -p "$TOOLS"

if [ ! -x "$TOOLS/venv/bin/zizmor" ]; then
  python3 -m venv "$TOOLS/venv"
  "$TOOLS/venv/bin/pip" install -q \
    "zizmor==$ZIZMOR" "actionlint-py==$ACTIONLINT_PY" "typos==$TYPOS" "yamllint==$YAMLLINT" \
    "shellcheck-py==$SHELLCHECK_PY" "detect-secrets==$DETECT_SECRETS"
fi

if [ ! -x "$TOOLS/node/node_modules/.bin/markdownlint-cli2" ]; then
  mkdir -p "$TOOLS/node"
  (cd "$TOOLS/node" && npm init -y >/dev/null && npm install --silent "markdownlint-cli2@$MARKDOWNLINT_CLI2")
fi

if [ "${1:-}" = "--swiftlint" ] && [ ! -x "$TOOLS/bin/swiftlint" ]; then
  if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null; then
    brew install swiftlint
  else
    rm -rf "$TOOLS/swiftlint-src"
    git clone -q --depth 1 --branch "$SWIFTLINT" https://github.com/realm/SwiftLint "$TOOLS/swiftlint-src"
    (cd "$TOOLS/swiftlint-src" && swift build -c release --product swiftlint)
    mkdir -p "$TOOLS/bin"
    cp "$TOOLS/swiftlint-src/.build/release/swiftlint" "$TOOLS/bin/swiftlint"
  fi
fi
echo "tools ready in $TOOLS"
