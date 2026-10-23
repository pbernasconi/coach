import Foundation

extension AppAPISamples {
    /// The `GET /api/app/weigh-ins/{date}` example of APP-API.md, as written there.
    public static let weighInContract = #"""
        {
          "date": "2026-10-22", "dateText": "Thursday, Oct 22",
          "weight": { "kg": 83.2, "text": "83.2", "unit": "kg" },
          "bodyFat": { "pct": 18.4, "text": "18.4 %" },
          "changes": [
            { "id": "previous", "label": "Since yesterday", "kg": -0.3, "text": "▼ 0.3 kg", "tone": "good", "noteText": "83.5 kg on Oct 21" },
            { "id": "4w", "label": "4 weeks", "kg": -1.4, "text": "▼ 1.4 kg", "tone": "good", "noteText": "-0.35 kg a week" }
          ],
          "trend": {
            "kg": 83.52, "text": "83.5", "rate": { "kgPerWeek": -0.26, "text": "▼ 0.26 kg/wk", "tone": "good" },
            "offKg": -0.3, "swingKg": 0.4,
            "noteText": "Today is 0.3 kg under your trend, inside your normal ±0.4 kg day-to-day swing. Read the line, not the dot."
          },
          "series": [{ "date": "2026-09-22", "kg": 84.6, "trendKg": 84.31 }, { "date": "2026-10-22", "kg": 83.2, "trendKg": 83.52 }],
          "source": "renpho", "recordedAt": "2026-10-22T14:05:00.000Z",
          "newerDate": null, "olderDate": "2026-10-21"
        }
        """#

    /// A first weigh-in: no body fat, nothing to compare.
    public static let weighInFirst = #"""
        {
          "date": "2026-10-22", "dateText": "Thursday, Oct 22",
          "weight": { "kg": 83.2, "text": "83.2", "unit": "kg" },
          "bodyFat": null, "changes": [],
          "trend": { "kg": 83.2, "text": "83.2", "rate": null, "offKg": 0, "swingKg": null, "noteText": null },
          "series": [{ "date": "2026-10-22", "kg": 83.2, "trendKg": 83.2 }],
          "source": "renpho", "recordedAt": null, "newerDate": null, "olderDate": null
        }
        """#
}
