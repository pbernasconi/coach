# Scale bridge

A $20 ESP32-S3 (M5Stack AtomS3U or AtomS3 Lite) in a bathroom USB charger. When someone steps on the Renpho
Elis 1, it connects to the scale over Bluetooth, takes the final reading, and posts `weight_kg` and `body_fat_pct`
to Coach (`POST /api/vitals/sync`, COACH-API.md). The Health page charts them like Garmin's. No phone, no app.

```
Renpho Elis 1 ──Bluetooth──▶ ESP32 bridge ──Wi-Fi, HTTPS──▶ Coach /api/vitals/sync ──▶ Health page
 (wakes on step)  handshake    weight, impedance → body fat     Lift sync token
```

## Setup

1. Copy `include/config.example.h` to `include/config.h` and fill it in: Wi-Fi (2.4 GHz), the Lift sync token
   (Coach > Settings > Connect Lift > Show sync token), height, birth date, sex, time zone, an OTA password.
2. Plug the board into the Mac (the AtomS3U needs a USB-C to USB-A adapter) and flash:
   ```bash
   pip install platformio        # once
   cd devices/scale-bridge
   pio run -e atoms3 -t upload   # any other ESP32-S3 board: -e esp32s3
   pio device monitor            # optional: watch the log
   ```
   If the upload cannot find the board, hold its button while plugging it in (download mode) and try again.
3. Plug it into a USB charger within a few metres of the scale. Delete or log out of the Renpho app on your phone:
   the scale takes one connection at a time, and the app would take some weigh-ins.
4. Step on the scale. The light turns blue while it reads the scale, then green for a few seconds once the reading
   is in Coach. Red means the post failed (the log says why; 401 is a wrong token).

Later updates go over Wi-Fi: `pio run -e atoms3-ota -t upload`. `ota_auth.py` sends `OTA_PASSWORD` from
`include/config.h` (`SCALE_OTA_PASSWORD` overrides it) and looks up `scale-bridge.local` itself, because espota's own
lookup fails on macOS. `SCALE_BRIDGE_IP=192.168.x.y` skips the lookup. If the board was flashed with another
password, flash once over USB.

## Checking on it

- **Coach > Settings > Bathroom scale** shows the bridge's last report (every 15 minutes): Wi-Fi signal, uptime and
  why it last restarted, firmware, waiting readings, and the last scale session with its log. Coach warns when the
  bridge stops reporting. No need to be on the home Wi-Fi.
- `http://scale-bridge.local/` (same Wi-Fi) shows Wi-Fi strength, the remembered scale, readings waiting to be
  posted, every Bluetooth device heard in the last 5 minutes (address, signal, name, manufacturer data in hex; the
  scale shows up while you stand on it), and the last 80 log lines, including every frame to and from the scale in hex. Send that log when
  something is off.
- `http://scale-bridge.local/status.json` is the same report as JSON.
- `http://scale-bridge.local/forget` forgets the remembered scale (for a new scale).

## How it works

- **Finding the scale.** The bridge scans all the time. QN scales advertise manufacturer data with company id
  `0xFFFF` and the name `QN-Scale` or `Renpho…`. After the first good reading it remembers that scale's address
  and ignores other devices.
- **The handshake** (lib/qn, tested in `test/test_qn` with captured frames):
  `0x12` unit request → we send `0x13` (kg); `0x14` init request → we send `0x20` with the time (sets the scale's
  clock); `0x21` pre-measurement → on the Renpho "extended" firmware we send a guest profile (`0xA0`) so the scale
  works out body fat itself, on "basic" firmware we ask for stored readings (`0x22`); then `0x10` measurement
  frames until the final one, and we send the end command (`0x1F`). If the scale goes quiet after the unit reply,
  the bridge also sends `0x02` (current time), which some QN firmware waits for.
- **Body fat.** Extended firmware reports its own. Otherwise the bridge uses Renpho's formula (algorithm `0x04`),
  which reproduces the scale's numbers within 0.1 point. It depends mostly on BMI and age; impedance moves it
  by about one point. Treat it as a trend.
- **Missed weigh-ins.** The scale keeps readings taken while nobody was connected. The bridge collects them on
  the next weigh-in and posts those from the last 30 days, unless a newer live reading already covers the day.
- **Broadcast-only firmware.** Some Elis 1 units never accept a connection and put the weight in their
  advertisement. The bridge reads those too, weight only.
- **Reconnecting.** A session that ends without a reading (the scale dropped the link mid-measurement, or we
  connected while it was still settling) is retried after under a second: the scale stores the finished weigh-in and
  hands it over on the next connection. After a reading the bridge ignores the scale's leftover advertising for 15 s.
- **Clock resets.** New batteries restart the scale's clock from zero. Weigh-ins taken before the bridge sets the
  clock again (on the first connection) carry no real time and are skipped; the log says so.
- **Staying online.** The bridge reconnects Wi-Fi by hand after a minute offline and restarts after ten. Waiting
  readings are kept in flash, so a restart, an update or a power cut does not lose them.
- **Posting.** Readings are retried every minute until Coach takes them. Each day keeps its latest reading
  (the server upserts on date and metric). `source` is `Renpho Elis 1 (scale bridge)`.

Not covered: the newer ES-CS20M revision on service `0x1A10` (HVIN `ESCS20MB2`). The log would say "no QN
service"; ble-scale-sync documents that protocol if it is ever needed.

## Tests

```bash
pio test -e native   # protocol and body fat, on the computer
pio run -e atoms3    # firmware build (needs include/config.h; CI copies the example)
```

Protocol sources (MIT): [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) for the Renpho
flavors, frame layouts and the body fat formula with golden values, and
[qn-scale](https://github.com/PavelDemyanov/qn-scale) for the handshake.
