#!/usr/bin/env bash
# Runs a Swift package's tests in the background of a CI job and reports them later, so they use time the job
# spends waiting anyway (the screenshot jobs wait for the build job's app).
#   scripts/ci-package-tests.sh start <package dir>   starts `swift test` there
#   scripts/ci-package-tests.sh wait <package dir>    waits for it, prints the log's tail and unique errors, and
#                                                     exits with its status
set -euo pipefail
dir="$2"
name="$(basename "$dir")"
log="$RUNNER_TEMP/$name-tests.log"
status="$RUNNER_TEMP/$name-tests.status"
case "$1" in
  start)
    rm -f "$status"
    (
      code=0
      (cd "$dir" && swift test) >"$log" 2>&1 || code=$?
      echo "$code" >"$status"
    ) >/dev/null 2>&1 &
    ;;
  wait)
    while [ ! -f "$status" ]; do sleep 2; done
    echo "::group::$name tests (tail)"
    tail -n 20 "$log"
    echo "::endgroup::"
    echo "::group::Unique errors ($name)"
    grep -E "(error|warning):|✘|recorded an issue" "$log" | grep -v "^ *|" | sort -u | head -n 150 || true
    echo "::endgroup::"
    exit "$(cat "$status")"
    ;;
  *) echo "usage: $0 start|wait <package dir>" >&2 && exit 2 ;;
esac
