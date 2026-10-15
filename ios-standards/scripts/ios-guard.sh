#!/usr/bin/env bash
# ios-guard.sh: fail on banned APIs and patterns from IOS_GUIDELINES.md.
#
#   scripts/ios-guard.sh                # scan every Swift file under the repo's ios/ folder
#   scripts/ios-guard.sh path/A.swift   # scan only these files (used by the Claude Code hook)
#
# Grep-based on purpose: it runs anywhere (macOS, Linux CI, an agent's sandbox) with no build.
# Each finding prints file:line, the rule id and the fix. Exit code 1 if anything is found.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(find "$ROOT" -name '*.swift' -not -path '*/.build/*' -not -path '*/DerivedData/*' \
    -not -path '*/Generated/*' -not -path '*/checkouts/*')
fi

fail=0
report() { # file line rule message
  printf '%s:%s: [%s] %s\n' "$1" "$2" "$3" "$4"
  fail=1
}

is_test()    { [[ "$1" == *Tests/* || "$1" == *Tests.swift || "$1" == */Testing/* ]]; }
is_preview() { [[ "$1" == *Previews.swift || "$1" == *Fixtures.swift ]]; }
is_design()  { [[ "$1" == */Design/* || "$1" == */CraftTokens/* ]]; }  # token layers own raw colours
is_root()    { [[ "$1" == */App/* ]]; }          # composition root may touch live clocks / Date
is_settings(){ [[ "$1" == *Settings*.swift ]]; }

# rule~regex~message~scope   (scope: all, notest, notestpreview, notdesign, notroot, notsettings)
RULES=(
  'CONC-6~Task\.detached~Use structured concurrency (.task, async let, TaskGroup).~all'
  'CONC-6~DispatchQueue~Use actors or async/await, not GCD.~all'
  'CONC-6~DispatchSemaphore~Never block a thread; await instead.~all'
  'CONC-6~\bNSLock\b~Use an actor for shared mutable state.~all'
  'CONC-6~@unchecked Sendable~Make the type Sendable properly or isolate it.~all'
  'CONC-6~nonisolated\(unsafe\)~Isolate the state instead.~all'
  'CONC-6~@preconcurrency~Fix the Sendable issue instead of silencing it.~all'
  'CONC-6~MainActor\.assumeIsolated~Make the caller MainActor-isolated.~all'
  'CONC-6~Thread\.sleep~Never sleep a thread.~all'
  'CONC-5~Task\.sleep~Inject any Clock<Duration> and use clock.sleep(for:).~notroot'
  'CONC-5~[^.A-Za-z]Date\(\)~Inject now: @Sendable () -> Date.~notroot'
  'DI-3~URLSession\.shared~Inject a URLSession.~all'
  'DI-3~static (let|var) shared~No singletons; inject through AppDependencies.~notest'
  'DI-3~UserDefaults\.standard~Only the Settings type touches UserDefaults.~notsettings'
  'DI-4~@Environment\([A-Z][A-Za-z]*\.self\)~Pass services through init, not @Environment.~all'
  'ERR-3~(^|[^A-Za-z.])print\(~Use Log.<category> (os.Logger).~notest'
  'ERR-3~debugPrint\(~Use Log.<category>.~all'
  'ERR-3~NSLog\(~Use Log.<category>.~all'
  'ERR-3~try!~Handle the error or use try? with a reason.~notestpreview'
  'UI-7~AnyView~Use @ViewBuilder or a concrete view.~all'
  'UI-4~\.onTapGesture~Use a Button so it is accessible.~all'
  'UI-7~id: \\\.self\)~Use a stable model id, not \\.self.~all'
  'UI-1~Color\(red:~Use a Design token.~notdesign'
  'UI-1~#colorLiteral~Use a Design token.~notdesign'
  'UI-1~Color\(hex:~Use a Design token.~notdesign'
  'PERF-5~\.id\(UUID\(\)\)~Never give a view a new identity on every body run.~all'
)

for f in "${FILES[@]}"; do
  [[ "$f" == *.swift ]] || continue
  [ -f "$f" ] || continue
  for entry in "${RULES[@]}"; do
    IFS='~' read -r rule regex msg scope <<<"$entry"
    case "$scope" in
      notest)        is_test "$f" && continue ;;
      notestpreview) (is_test "$f" || is_preview "$f") && continue ;;
      notdesign)     is_design "$f" && continue ;;
      notroot)       (is_root "$f" || is_test "$f") && continue ;;
      notsettings)   is_settings "$f" && continue ;;
    esac
    while IFS=: read -r line _; do
      [ -n "$line" ] && report "$f" "$line" "$rule" "$msg"
    done < <(grep -nE "$regex" "$f" | grep -v 'ios-guard: allow' || true)
  done
  # LAY-5: file length
  n=$(wc -l <"$f" | tr -d ' ')
  if [ "$n" -gt 250 ] && ! is_test "$f"; then report "$f" 1 'LAY-5' "File is $n lines (max 250). Split it."; fi
  # SCR-3: ViewModel init must not start work (scan only the init body, by brace depth)
  if [[ "$f" == *ViewModel.swift ]]; then
    hit=$(awk '
      /^[[:space:]]*(convenience |public |package )?init[(<]/ { inside=1; depth=0; opened=0 }
      inside {
        if ($0 ~ /Task[[:space:]]*\{|Task\.detached|\.sink|for await/) { print NR; exit }
        n=gsub(/\{/, "{"); m=gsub(/\}/, "}"); depth+=n-m; if (n>0) opened=1
        if (opened && depth<=0) inside=0
      }' "$f")
    [ -n "$hit" ] && report "$f" "$hit" 'SCR-3' 'ViewModel init starts work. Move it into run().'
  fi
  # LAY-4: banned names
  if [[ "$f" =~ /(Utils|Helpers|Common|Shared|Misc)/ ]] || [[ "$(basename "$f")" =~ ^(Utils|Helpers|.*Manager)\.swift$ ]]; then
    report "$f" 1 'LAY-4' 'Name the file/folder for what it does (no Utils/Helpers/Common/Shared/Manager).'
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "ios-guard: violations found. Fix them, or add '// ios-guard: allow <reason>' on the line if truly justified." >&2
  exit 1
fi
echo "ios-guard: clean (${#FILES[@]} files)"
