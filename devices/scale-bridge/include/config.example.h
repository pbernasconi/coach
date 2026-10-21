// Copy to include/config.h and fill in. config.h is git-ignored: it holds the Wi-Fi password and the Coach token.
#pragma once

// Home Wi-Fi. The ESP32 only joins 2.4 GHz networks.
#define WIFI_SSID "your-network"
#define WIFI_PASSWORD "your-password"

// Coach's vitals endpoint and the bearer token. The token is the Lift sync token: Coach > Settings > Connect Lift >
// Show sync token. The endpoint accepts it for health data (COACH-API.md, POST /api/vitals/sync).
#define COACH_URL "https://coach.paolobernasconi.com/api/vitals/sync"
#define COACH_TOKEN "paste-the-token"

// You, for body fat. Renpho's formula uses height, age and sex.
#define PROFILE_SEX qn::Sex::Male  // or qn::Sex::Female
#define PROFILE_HEIGHT_CM 180
#define PROFILE_BIRTH_YEAR 1990
#define PROFILE_BIRTH_MONTH 1
#define PROFILE_BIRTH_DAY 1

// Your time zone (POSIX form), so a weigh-in lands on the right day. Pacific time:
#define TIMEZONE "PST8PDT,M3.2.0,M11.1.0"

// Password for Wi-Fi updates (`pio run -e atoms3-ota -t upload`). Pick anything.
#define OTA_PASSWORD "change-me"

// Leave empty: the bridge remembers the first scale it reads. Set it (e.g. "ff:05:00:0a:fb:27") to pin one scale.
#define SCALE_MAC ""
