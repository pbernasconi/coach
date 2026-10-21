#!/usr/bin/env bash
# Read-only signing health checks for macOS: the code-signing certificates in the keychains, and a
# provisioning profile before a release uses it. Nothing here changes a keychain, a profile or an account.
#   scripts/ios-signing.sh --help
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ios-signing.sh identities [--min-days N]
      List the Apple Development and Apple Distribution certificates in the keychains: expiry, team and
      whether this Mac has the private key. A certificate without its key cannot sign. Exit 1 when a
      certificate with a key expires within N days (default 30).

  ios-signing.sh profile <file.mobileprovision> [--team ID] [--bundle-id ID] [--type T] [--min-days N]
      Check a provisioning profile: type (development, adhoc, appstore or enterprise), team, app id,
      expiry and the expiry of each certificate in it. Exit 1 when a check fails.
      --plist <file> reads an already decoded profile instead (for tests).

Options:
  --min-days N   the profile and its certificates must stay valid for N more days (default 30)
  -h, --help     show this help
EOF
}

die() {
  printf '[ios-signing] error: %s\n' "$*" >&2
  exit 1
}

MIN_DAYS=30 TEAM="" BUNDLE="" TYPE="" PLIST="" FILE=""
COMMAND="${1:-}"
[ "$#" -gt 0 ] && shift
case "$COMMAND" in -h | --help | "")
  usage
  [ -n "$COMMAND" ] && exit 0
  exit 2
  ;;
esac
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help) usage && exit 0 ;;
    --min-days) MIN_DAYS="${2:?--min-days needs a number}" && shift ;;
    --team) TEAM="${2:?--team needs a value}" && shift ;;
    --bundle-id) BUNDLE="${2:?--bundle-id needs a value}" && shift ;;
    --type) TYPE="${2:?--type needs a value}" && shift ;;
    --plist) PLIST="${2:?--plist needs a file}" && shift ;;
    -*) die "unknown option $1" ;;
    *) FILE="$1" ;;
  esac
  shift
done
[[ "$MIN_DAYS" =~ ^[0-9]+$ ]] || die "--min-days must be a number"
MIN_SECONDS=$((MIN_DAYS * 86400))

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# cert_state <file> <PEM|DER>: "<ok|expiring|expired>|<notAfter>" for one certificate.
cert_state() {
  local file="$1" inform="$2" end
  end="$(openssl x509 -inform "$inform" -in "$file" -noout -enddate | sed 's/^notAfter=//')"
  if ! openssl x509 -inform "$inform" -in "$file" -noout -checkend 0 >/dev/null; then
    echo "expired|$end"
  elif ! openssl x509 -inform "$inform" -in "$file" -noout -checkend "$MIN_SECONDS" >/dev/null; then
    echo "expiring|$end"
  else
    echo "ok|$end"
  fi
}

subject_field() { # <pem> <field>
  openssl x509 -in "$1" -noout -subject -nameopt RFC2253 | sed -n "s/.*[=,]$2=\([^,]*\).*/\1/p" | head -1
}

identities() {
  command -v security >/dev/null || die "the security tool is macOS only"
  local with_key failed=0
  # SHA-1 hashes of the certificates that have a private key in a keychain.
  with_key="$(security find-identity -v -p codesigning | awk '/"/ {print $2}')"
  security find-certificate -a -p >"$TMP/all.pem" 2>/dev/null || true
  awk -v dir="$TMP" '/BEGIN CERTIFICATE/ {n++; f = dir "/cert-" n ".pem"} f {print > f} /END CERTIFICATE/ {close(f); f = ""}' \
    "$TMP/all.pem"
  printf '%-9s %-26s %-4s %-11s %s\n' STATE EXPIRES KEY TEAM NAME
  local pem cn team sha state end key
  for pem in "$TMP"/cert-*.pem; do
    [ -f "$pem" ] || continue
    cn="$(subject_field "$pem" CN)"
    case "$cn" in "Apple Development"* | "Apple Distribution"* | "iPhone Developer"* | "iPhone Distribution"*) ;; *) continue ;; esac
    team="$(subject_field "$pem" OU)"
    sha="$(openssl x509 -in "$pem" -noout -fingerprint -sha1 | sed 's/.*=//; s/://g')"
    key=no
    if grep -qi "^$sha$" <<<"$with_key"; then key=yes; fi
    IFS='|' read -r state end <<<"$(cert_state "$pem" PEM)"
    printf '%-9s %-26s %-4s %-11s %s\n' "$state" "$end" "$key" "${team:-?}" "$cn"
    if [ "$key" = yes ] && [ "$state" != ok ]; then failed=1; fi
  done
  echo
  echo "Apple limits the number of development and distribution certificates per account. A CI runner that"
  echo "signs automatically makes a new certificate each run unless it imports a stored one (see RUNNING.md)."
  return "$failed"
}

pl() { /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" 2>/dev/null || true; }
pl_raw() { plutil -extract "$1" raw "$PLIST" 2>/dev/null || true; }

profile() {
  if [ -z "$PLIST" ]; then
    [ -n "$FILE" ] || die "profile needs a .mobileprovision file"
    [ -f "$FILE" ] || die "not found: $FILE"
    PLIST="$TMP/profile.plist"
    security cms -D -i "$FILE" >"$PLIST" 2>/dev/null ||
      openssl smime -inform der -verify -noverify -in "$FILE" >"$PLIST" 2>/dev/null ||
      die "cannot decode $FILE"
  fi
  local errors=() name uuid team app_id expiry get_task_allow all_devices devices kind
  name="$(pl Name)"
  uuid="$(pl UUID)"
  team="$(pl TeamIdentifier:0)"
  app_id="$(pl Entitlements:application-identifier)"
  expiry="$(pl_raw ExpirationDate)"
  get_task_allow="$(pl Entitlements:get-task-allow)"
  all_devices="$(pl ProvisionsAllDevices)"
  devices="$(pl_raw ProvisionedDevices)"
  if [ "$get_task_allow" = true ]; then
    kind=development
  elif [ "$all_devices" = true ]; then
    kind=enterprise
  elif [ -n "$devices" ] && [ "$devices" != 0 ]; then
    kind=adhoc
  else
    kind=appstore
  fi
  printf '%-12s %s\n' name "$name" uuid "$uuid" type "$kind" team "$team" app-id "$app_id" \
    expires "$expiry" devices "${devices:-0}"

  [ -n "$uuid" ] || errors+=("the profile has no UUID")
  [ -z "$TYPE" ] || [ "$TYPE" = "$kind" ] || errors+=("the profile is $kind, expected $TYPE")
  [ -z "$TEAM" ] || [ "$TEAM" = "$team" ] || errors+=("the team is $team, expected $TEAM")
  if [ -n "$BUNDLE" ]; then
    local id="${app_id#*.}"
    # shellcheck disable=SC2053 # the app id may be a wildcard pattern such as com.example.*
    [[ "$BUNDLE" == $id ]] || errors+=("the app id $app_id does not cover $BUNDLE")
  fi
  if [ -z "$expiry" ]; then
    errors+=("the profile has no ExpirationDate")
  else
    local expires_at
    expires_at="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$expiry" +%s 2>/dev/null || date -u -d "$expiry" +%s)"
    if [ "$expires_at" -le $(($(date +%s) + MIN_SECONDS)) ]; then
      errors+=("the profile expires $expiry, sooner than $MIN_DAYS days from now")
    fi
  fi

  local count i state end
  count="$(pl_raw DeveloperCertificates)"
  if [ -z "$count" ] || [ "$count" = 0 ]; then
    errors+=("the profile contains no certificate")
  else
    for ((i = 0; i < count; i++)); do
      plutil -extract "DeveloperCertificates.$i" raw "$PLIST" | base64 -d >"$TMP/cert-$i.der"
      if ! IFS='|' read -r state end <<<"$(cert_state "$TMP/cert-$i.der" DER 2>/dev/null)" || [ -z "$state" ]; then
        errors+=("certificate $i is unreadable")
        continue
      fi
      printf '%-12s %s (%s)\n' "certificate" "$end" "$state"
      [ "$state" = ok ] || errors+=("certificate $i expires $end, sooner than $MIN_DAYS days from now")
    done
  fi

  if [ "${#errors[@]}" -gt 0 ]; then
    printf 'FAIL: %s\n' "${errors[@]}" >&2
    return 1
  fi
  echo "profile ok"
}

case "$COMMAND" in
  identities) identities ;;
  profile) profile ;;
  *) die "unknown command '$COMMAND' (see --help)" ;;
esac
