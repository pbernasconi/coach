#!/bin/sh
# Runs scripts/zwift-workouts.mjs every 30 minutes on this Mac (launchd), so Zwift always has the plan's indoor
# rides. Remove with: launchctl bootout gui/$(id -u)/com.coach.zwift-workouts && rm ~/Library/LaunchAgents/com.coach.zwift-workouts.plist
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
NODE=$(command -v node)
PLIST="$HOME/Library/LaunchAgents/com.coach.zwift-workouts.plist"
LOG="$HOME/Library/Logs/coach-zwift-workouts.log"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.coach.zwift-workouts</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--env-file=$REPO/.env.local</string>
    <string>$REPO/scripts/zwift-workouts.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/com.coach.zwift-workouts" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed. It runs now and every 30 minutes. Log: $LOG"
