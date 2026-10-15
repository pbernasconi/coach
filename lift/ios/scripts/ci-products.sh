#!/usr/bin/env bash
# Hands the build job's test products to the simulator jobs of the same CI run, through a run artifact.
#   scripts/ci-products.sh pack app <archive>    Lift.app from build/lift/Build/Products into a zstd tarball
#   scripts/ci-products.sh pack tests <archive>  the same plus the .xctestrun (after build-for-testing, Lift.app
#                                                holds the test bundle)
#   scripts/ci-products.sh fetch <name> <dir> waits until the run has the artifact <name>, then downloads and
#                                             unpacks it into <dir>; fails as soon as the build job fails
# fetch needs GH_TOKEN (actions: read), GITHUB_REPOSITORY and GITHUB_RUN_ID. The simulator jobs start with the
# build job and boot their simulator while they wait, instead of waiting for the build job to finish.
set -euo pipefail
case "$1" in
  pack)
    archive="$3"
    cd "$(dirname "$0")/../../../build/lift/Build/Products"
    files=(Debug-iphonesimulator/Lift.app)
    [ -d Debug-iphonesimulator/PackageFrameworks ] && files+=(Debug-iphonesimulator/PackageFrameworks)
    [ "$2" = tests ] && files+=(./*.xctestrun)
    tar -cf - "${files[@]}" | zstd -q -1 -T0 -o "$archive"
    ls -l "$archive"
    ;;
  fetch)
    name="$2"
    dir="$3"
    api="repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
    for ((i = 0; i < 240; i++)); do
      url="$(gh api "$api/artifacts?name=$name" --jq '.artifacts[0].archive_download_url // empty')"
      if [ -n "$url" ]; then
        echo "$(date -u +%T) $name is listed, downloading"
        mkdir -p "$dir"
        curl -fsSL --retry 3 -H "Authorization: Bearer $GH_TOKEN" -o "$dir.zip" "$url"
        unzip -p "$dir.zip" | zstd -q -d -c | tar -xf - -C "$dir"
        rm -f "$dir.zip"
        echo "$(date -u +%T) products ready after $((SECONDS / 60))m$((SECONDS % 60))s"
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
  *) echo "usage: $0 pack app|tests <archive> | fetch <name> <dir>" >&2 && exit 2 ;;
esac
