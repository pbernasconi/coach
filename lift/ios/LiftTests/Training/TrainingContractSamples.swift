import Foundation

/// The Activities and Trends examples from lift/APP-API.md, as the contract shows them, so a change to the contract
/// that the models cannot read fails a test.
enum TrainingContractSamples {
    static let trends = #"""
        {
          "generatedAt": "2026-10-20T21:02:25.218Z",
          "timeZone": "America/Los_Angeles",
          "today": "2026-10-20",
          "performance": {
            "ok": true,
            "staleText": null,
            "tiles": [
              { "key": "hours", "label": "Hours, last 4 weeks", "valueText": "26:36", "sport": null,
                "delta": { "pct": -7, "text": "▼ 7%", "tone": "down" }, "footText": "vs the 4 weeks before",
                "spark": { "values": [5.02, 0.93], "labels": ["Week of Oct 12", "Week of Oct 19"], "texts": ["5:01 h", "0:56 h"] } },
              { "key": "run", "label": "Run, last 4 weeks", "valueText": "72 km", "sport": "run", "delta": null,
                "footText": "Pace 5:35/km", "spark": { "values": [39.81, 0], "labels": ["…"], "texts": ["…"] } },
              { "key": "form", "label": "Form today", "valueText": "+15", "sport": null, "delta": null,
                "footText": "Fresh · fitness 51 · strength 2/8", "spark": { "values": [52.7, 51.4], "labels": ["2026-10-18", "2026-10-20"], "texts": ["fitness 53", "fitness 51"] } }
            ],
            "weeklyHours": {
              "sports": [{ "id": "ride", "label": "Ride" }, { "id": "run", "label": "Run" }, { "id": "hike", "label": "Hike" }],
              "average": 6.89,
              "averageText": "avg 6:53",
              "weeks": [
                { "week": "2026-10-12", "label": "Oct 12", "current": false, "hours": 5.02, "hoursText": "5:01",
                  "sports": [{ "id": "run", "hours": 3.64, "hoursText": "3:39", "detail": "Run · 39.8 km" },
                             { "id": "hike", "hours": 1.38, "hoursText": "1:23", "detail": "Hike · 4.5 km" }],
                  "strength": 0, "tss": 320 },
                { "week": "2026-10-19", "label": "Oct 19", "current": true, "hours": 0.93, "hoursText": "0:56",
                  "sports": [{ "id": "ride", "hours": 0.93, "hoursText": "0:56", "detail": "Virtual ride · 30 km" }],
                  "strength": 0, "tss": 49 }
              ]
            },
            "table": [
              { "week": "2026-10-19", "current": true, "label": "Oct 19 (this week)", "hoursText": "0:56", "runKmText": "-",
                "runPaceText": "-", "rideKmText": "30", "strengthText": "-", "tssText": "49", "planText": "0/1" }
            ]
          },
          "ramp": {
            "ok": true,
            "rates": [
              { "days": 7, "label": "7 days", "change": -2.1, "changeText": "-2.1", "perWeek": -2.1, "perWeekText": "-2.1/wk",
                "level": "falling", "levelText": "Falling", "warn": false },
              { "days": 365, "label": "1 year", "change": null, "changeText": "–", "perWeek": null, "perWeekText": null,
                "level": null, "levelText": "Not enough data", "warn": false }
            ],
            "note": "CTL points. Over +8 a week is a high injury risk; +5 to +8 is aggressive."
          },
          "peaks": {
            "ok": true,
            "note": "From Strava streams. Elapsed time for runs, so stops count. 304 activities still to scan.",
            "windows": [{ "key": "all", "label": "All time" }, { "key": "d90", "label": "90 days" }, { "key": "d28", "label": "28 days" }],
            "power": {
              "title": "Power", "unitText": "best average, W", "empty": false,
              "rows": [
                { "span": 5, "label": "5 s", "cells": {
                  "all": { "value": 861, "text": "861 W", "subText": null, "date": "2026-06-21", "dateText": "Jun 21, 26",
                           "activityId": "19015136492", "name": "Cycling", "best": true },
                  "d90": { "value": 829, "text": "829 W", "subText": null, "date": "2026-09-07", "dateText": "Sep 7, 26",
                           "activityId": "20081894381", "name": "Cycling", "best": false },
                  "d28": null } }
              ]
            },
            "run": {
              "title": "Run", "unitText": "fastest time · pace /km", "empty": false,
              "rows": [
                { "span": 1000, "label": "1 km", "cells": {
                  "all": { "value": 267, "text": "4:27", "subText": "4:27", "date": "2025-10-31", "dateText": "Oct 31, 25",
                           "activityId": "16313062658", "name": "Morning Run", "best": true },
                  "d90": null, "d28": null } }
              ]
            }
          },
          "lift": {
            "ok": true,
            "hasData": true,
            "emptyText": null,
            "unit": "lb",
            "muscles": {
              "band": { "min": 10, "max": 20 },
              "note": "This week. A set counts 1 for a primary muscle and 0.5 for a secondary one.",
              "rows": [
                { "muscle": "back", "label": "Back", "week": 0, "weekText": "0", "avg": 3, "avgText": "3",
                  "status": "below", "statusText": "below target" }
              ]
            },
            "mainLifts": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000001", "name": "Back squat", "points": [{ "day": "2026-09-25", "e1rm": 323 }], "latest": 323,
                            "latestText": "323 lb", "change": 0.041, "changeText": "+4%", "tone": "good", "sparkText": null }]
          }
        }
        """#

    static let list = #"""
        {
          "generatedAt": "2026-10-20T21:03:42.893Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20",
          "activities": [
            {
              "activityId": "20614350022", "name": "Morning Run", "sport": "run", "sportType": "Run", "typeText": "Run",
              "startLocal": "2026-10-17T07:15:54", "day": "2026-10-17", "startText": "Sat, Oct 17 · 7:15 AM",
              "distance": 12010.4, "distanceText": "12.01 km", "movingSeconds": 4038, "durationText": "1:07:18",
              "speed": 2.974, "paceText": "5:36 /km", "speedText": null, "tss": 84, "tssText": "84 TSS",
              "indoor": false, "commute": false, "plannedTitle": null,
              "subtitle": "12.01 km · 1:07:18 · 5:36 /km · 84 TSS"
            }
          ],
          "plannedOk": true,
          "nextCursor": "19944258397"
        }
        """#

    static let detail = #"""
        {
          "generatedAt": "2026-10-20T21:05:10.000Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20",
          "activityId": "20614350022",
          "header": {
            "ok": true, "activityId": "20614350022", "name": "Morning Run", "sport": "run", "sportType": "Run", "typeText": "Run",
            "startLocal": "2026-10-17T07:15:54", "day": "2026-10-17", "whenText": "Saturday, October 17, 2026 at 7:15 AM",
            "place": "Kyoto, Japan", "indoor": false, "commute": false,
            "subtitle": "Saturday, October 17, 2026 at 7:15 AM · Kyoto, Japan · Run",
            "description": null, "prevId": "20577277152", "nextId": "20655239904",
            "stravaUrl": "https://www.strava.com/activities/20614350022",
            "fetch": { "pending": false, "note": null }
          },
          "overview": {
            "ok": true,
            "big": [{ "label": "Distance", "valueText": "12.01", "unit": "km" }, { "label": "Moving Time", "valueText": "1:07:18" }, { "label": "Pace", "valueText": "5:36", "unit": "/km" }],
            "small": [{ "label": "Elevation", "valueText": "56", "unit": "m" }, { "label": "Calories", "valueText": "920" }],
            "achievementsText": "7 PRs · 7 achievements · 4 kudos"
          },
          "weather": { "ok": true, "headline": "Clear, 16 °C", "rows": [{ "label": "Wind", "valueText": "3.9 km/h NNW" }], "source": "Open-Meteo, the hour nearest the start" },
          "equipment": { "ok": true, "device": "Garmin fēnix 7S Pro", "gear": { "label": "Shoes", "name": "Nike AlphaFLY", "distanceText": "(1,464 km)" } },
          "splits": { "ok": true, "note": null, "rows": [{ "index": 1, "distance": 1000.2, "speed": 3.04, "gapSpeed": 3.11, "label": "1", "paceText": "5:29", "gapText": "5:22", "elevText": "+3", "hrText": "137" }] },
          "route": { "ok": true, "points": [[34.99831, 135.76627], [34.99827, 135.76625]] },
          "sameRoute": null,
          "coach": {
            "ok": true,
            "planned": null,
            "plannedEmptyText": "Not matched to a planned workout.",
            "load": {
              "tss": 84, "method": "hr", "tssText": "84", "methodText": "from average heart rate", "emptyText": null,
              "rows": [{ "key": "ctl", "label": "Fitness (CTL)", "value": 54, "valueText": "54 (+0.7)" }, { "key": "tsb", "label": "Form (TSB)", "value": 6, "valueText": "+6 fresh (−5.3)" }]
            },
            "garmin": { "day": "2026-10-17", "emptyText": null, "rows": [{ "key": "sleep", "label": "Sleep the night before", "value": 82, "valueText": "82 · 6:29 h" }, { "key": "hrv", "label": "HRV (night)", "value": 103, "valueText": "103 ms" }] }
          },
          "analysis": {
            "ok": true, "points": 300, "smoothingS": 30, "note": "Pace is upside down: faster is higher.", "emptyText": null,
            "x": { "distanceKm": [0.011, 0.039, 0.081], "timeS": [0, 12, 24] },
            "streams": [
              { "key": "pace", "label": "Pace", "unit": "/km", "values": [516, 403, 322], "avg": 336.25, "avgText": "5:36", "invert": true },
              { "key": "gap", "label": "GAP", "unit": "/km", "values": [524, 394, 313], "avg": 333, "avgText": "5:33", "invert": true, "overlayOf": "pace" },
              { "key": "hr", "label": "Heart rate", "unit": "bpm", "values": [94, 104, 116], "avg": 145.4, "avgText": "145" },
              { "key": "alt", "label": "Elevation", "unit": "m", "values": [38, 38, 38], "avg": null, "avgText": null, "area": true }
            ]
          },
          "paceBars": {
            "ok": true, "title": "Pace Analysis", "unit": "/km", "hasGap": true,
            "modes": [
              { "key": "splits", "avg": 2.956, "avgText": "5:38", "gapAvg": 2.985, "gapAvgText": "5:35",
                "bars": [{ "label": "Km 1", "width": 1000.2, "value": 3.04, "valueText": "5:29", "gap": 3.11, "gapText": "5:22", "timeText": "5:29", "distanceText": "1.00", "hrText": "137" }] },
              { "key": "laps", "avg": 2.949, "avgText": "5:39", "gapAvg": 2.98, "gapAvgText": "5:36", "bars": [] },
              { "key": "smoothed", "timeS": [0, 12, 24], "values": [2.43, 2.7, 2.73], "gapValues": [2.48, 2.75, 2.77] }
            ]
          },
          "paceHistogram": {
            "ok": true, "note": "Moving time per 15 s of pace", "unit": "/km", "avgIndex": 12, "avgText": "avg 5:36",
            "bins": [{ "fromS": 330, "toS": 345, "label": "5:30", "seconds": 1296, "timeText": "21:36", "percent": 32 }]
          },
          "relativeEffort": {
            "ok": true, "sufferScore": 17, "trimp": 117, "tss": 84, "note": null,
            "stats": [{ "label": "Relative Effort (Strava)", "valueText": "17" }, { "label": "TRIMP (from HR)", "valueText": "117" }, { "label": "Coach TSS", "valueText": "84" }, { "label": "TSS per hour", "valueText": "75" }]
          },
          "heartRate": {
            "ok": true, "note": "Strava's zones · avg 145 bpm · max 156 bpm",
            "zones": [{ "zone": 2, "name": "Moderate", "min": 122, "max": 153, "rangeText": "123–153 bpm", "timeText": "1:04:44", "seconds": 3884, "percent": 96 }]
          },
          "power": null,
          "laps": { "ok": true, "hasPower": true, "hasGap": true, "rows": [{ "index": 1, "name": "Lap 0", "distance": 1000, "movingSeconds": 330, "speed": 3.03, "distanceText": "1.00 km", "timeText": "5:30", "paceText": "5:30 /km", "gapText": "5:14 /km", "elevText": "7 m", "hrText": "137 bpm", "powerText": "369 W" }] },
          "bestEfforts": { "ok": true, "note": "From Strava", "rows": [{ "label": "1K", "distance": 1000, "seconds": 320, "prRank": null, "timeText": "5:20", "paceText": "5:20 /km", "rankText": "" }] },
          "segments": { "ok": true, "count": 9, "note": "9 segments · PRs and top 10s first", "rows": [{ "id": "12179678", "name": "Shijo-Imadegawa", "distance": 2800.5, "seconds": 933, "prRank": 1, "komRank": null, "distanceText": "2.80 km", "gradeText": "0.4%", "timeText": "15:33", "paceText": "5:33 /km", "hrText": "150", "rankText": "PR" }] }
        }
        """#
}
