#!/usr/bin/env bash
# Runs `swift test` for several Swift packages side by side, then prints a summary, and for each failed
# package the tail of its log and its unique errors. Works on macOS and Linux.
#   scripts/package-tests.sh --help
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: package-tests.sh [options] [package dir ...]

With no package dirs, it tests every Packages/*/ folder that has a Package.swift.

Options:
  --parallel N        packages that test at the same time (default 2)
  --jobs N            `swift test -j N` for each package (cap it when many agents build on one Mac)
  --scratch-root DIR  build each package in DIR/<package> instead of <package>/.build, so two checkouts
                      or agents never share build folders
  --filter PATTERN    pass --filter PATTERN to swift test
  --logs DIR          keep the logs in DIR (default: a temporary folder that is removed at the end)
  -h, --help          show this help
Exit status: 1 when a package failed, else 0.
EOF
}

PARALLEL=2 JOBS="" SCRATCH="" FILTER="" LOGS=""
PACKAGES=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help) usage && exit 0 ;;
    --parallel) PARALLEL="${2:?--parallel needs a number}" && shift ;;
    --jobs) JOBS="${2:?--jobs needs a number}" && shift ;;
    --scratch-root) SCRATCH="${2:?--scratch-root needs a folder}" && shift ;;
    --filter) FILTER="${2:?--filter needs a pattern}" && shift ;;
    --logs) LOGS="${2:?--logs needs a folder}" && shift ;;
    -*) echo "unknown option $1" >&2 && exit 2 ;;
    *) PACKAGES+=("$1") ;;
  esac
  shift
done
[[ "$PARALLEL" =~ ^[1-9][0-9]*$ ]] || { echo "--parallel must be a number" >&2 && exit 2; }
if [ "${#PACKAGES[@]}" -eq 0 ]; then
  for manifest in Packages/*/Package.swift; do
    [ -f "$manifest" ] && PACKAGES+=("$(dirname "$manifest")")
  done
fi
[ "${#PACKAGES[@]}" -gt 0 ] || { echo "no packages: pass package folders or run where Packages/*/Package.swift exist" >&2 && exit 2; }
command -v swift >/dev/null || { echo "swift not found" >&2 && exit 1; }

if [ -z "$LOGS" ]; then
  LOGS="$(mktemp -d)"
  trap 'rm -rf "$LOGS"' EXIT
fi
mkdir -p "$LOGS"

# test_one <dir>: runs in the background; writes <name>.log and <name>.status.
test_one() {
  local dir="$1" name args=(test)
  name="$(basename "$dir")"
  [ -n "$JOBS" ] && args+=(-j "$JOBS")
  [ -n "$SCRATCH" ] && args+=(--scratch-path "$SCRATCH/$name")
  [ -n "$FILTER" ] && args+=(--filter "$FILTER")
  local code=0 start=$SECONDS
  (cd "$dir" && swift "${args[@]}") >"$LOGS/$name.log" 2>&1 || code=$?
  echo "$code $((SECONDS - start))" >"$LOGS/$name.status"
}

running=0
for dir in "${PACKAGES[@]}"; do
  [ -f "$dir/Package.swift" ] || { echo "not a package: $dir" >&2 && exit 2; }
  rm -f "$LOGS/$(basename "$dir").status"
  test_one "$dir" &
  running=$((running + 1))
  if [ "$running" -ge "$PARALLEL" ]; then
    wait -n 2>/dev/null || wait
    running=$((running - 1))
  fi
done
wait

failed=()
for dir in "${PACKAGES[@]}"; do
  name="$(basename "$dir")"
  read -r code seconds <"$LOGS/$name.status"
  if [ "$code" = 0 ]; then
    printf '  ok    %-28s %4s s\n' "$name" "$seconds"
  else
    printf '  FAIL  %-28s %4s s (exit %s)\n' "$name" "$seconds" "$code"
    failed+=("$name")
  fi
done
for name in ${failed[@]+"${failed[@]}"}; do
  printf '\n── %s: last lines\n' "$name"
  tail -n 20 "$LOGS/$name.log"
  printf '── %s: unique errors\n' "$name"
  grep -E "(error|warning):|✘|recorded an issue" "$LOGS/$name.log" | sort -u | head -n 100 || true
done
[ "${#failed[@]}" -eq 0 ]
