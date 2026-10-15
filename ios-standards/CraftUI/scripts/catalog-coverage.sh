#!/usr/bin/env bash
# catalog-coverage.sh: fail when a public component in CraftComponents/CraftPatterns is missing from the
# catalog (CONVENTIONS rule 14). A component counts as covered when it is a CatalogComponent case or is used in
# one of the catalog's demos (building blocks such as CardSection or ThumbnailBadge).
set -euo pipefail
cd "$(dirname "$0")/.."
catalog="Sources/CraftCatalog"
missing=0
while read -r name; do
  if ! grep -rqw "$name" "$catalog"; then
    echo "catalog-coverage: $name is public but not in $catalog" >&2
    missing=1
  fi
done < <(grep -rhoE '^(nonisolated )?public struct [A-Z][A-Za-z]*(<[^>]*>)?: View\b' \
  Sources/CraftComponents Sources/CraftPatterns | sed -E 's/.*struct ([A-Za-z]+).*/\1/' | sort -u)
[ "$missing" -eq 0 ] && echo "catalog-coverage: every public view is in the catalog"
exit "$missing"
