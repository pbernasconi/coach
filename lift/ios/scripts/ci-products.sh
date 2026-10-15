#!/usr/bin/env bash
# Hands the build job's test products to the simulator jobs of the same CI run, through a run artifact.
#   scripts/ci-products.sh pack <archive>     Lift.app (with its test bundle) and the .xctestrun from
#                                             build/lift/Build/Products into a zstd tarball
#   scripts/ci-products.sh fetch <name> <dir> waits until the run has the artifact <name>, then downloads and
#                                             unpacks it into <dir>; fails as soon as the build job fails
# fetch needs GH_TOKEN (actions: read), GITHUB_REPOSITORY and GITHUB_RUN_ID. The simulator jobs start with the
# build job and boot their simulator while they wait, instead of waiting for the build job to finish.
set -euo pipefail
case "$1" in
  pack)
    cd "$(dirname "$0")/../../../build/lift/Build/Products"
    extra=()
    [ -d Debug-iphonesimulator/PackageFrameworks ] && extra+=(Debug-iphonesimulator/PackageFrameworks)
    tar -cf - ./*.xctestrun Debug-iphonesimulator/Lift.app "${extra[@]}" | zstd -q -1 -T0 -o "$2"
    ls -l "$2"
    ;;
  fetch)
    name="$2"
    dir="$3"
    api="repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
    for ((i = 0; i < 240; i++)); do
      if [ -n "$(gh api "$api/artifacts?name=$name" --jq '.artifacts[0].id // empty')" ]; then
        mkdir -p "$dir"
        gh run download "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --name "$name" --dir "$dir.download"
        zstd -q -d -c "$dir.download"/*.tar.zst | tar -xf - -C "$dir"
        rm -rf "$dir.download"
        echo "products ready after $((SECONDS / 60))m$((SECONDS % 60))s"
        exit 0
      fi
      if [ "$(gh api "$api/jobs" --jq '[.jobs[] | select(.name == "build" and .conclusion == "failure")] | length')" != 0 ]; then
        echo "the build job failed" >&2
        exit 1
      fi
      sleep 5
    done
    echo "timed out waiting for $name" >&2
    exit 1
    ;;
  *) echo "usage: $0 pack <archive> | fetch <name> <dir>" >&2 && exit 2 ;;
esac
