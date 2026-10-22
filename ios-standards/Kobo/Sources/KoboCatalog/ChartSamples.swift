import Foundation
import KoboComponents
import SwiftUI

/// Made-up chart data for the catalog: smooth waves over fixed dates, so demos look the same on every run and never
/// describe anyone's real records. It imports SwiftUI because the chart models hold colours.
enum ChartSamples {
    static let start = Date(timeIntervalSinceReferenceDate: 780_000_000)
    static let day: TimeInterval = 86_400
    static var today: Date { start.addingTimeInterval(69 * day) }

    static func daily(_ days: Int, base: Double, swing: Double) -> [ChartPoint<Date>] {
        (0..<days).map { index in
            let x = Double(index)
            return ChartPoint(x: start.addingTimeInterval(x * day), y: base + swing * sin(x / 9) + x * 0.15)
        }
    }

    static func stream(base: Double, swing: Double, speed: Double) -> [ChartPoint<Double>] {
        stride(from: 0.0, through: 10, by: 0.1).map { km in
            ChartPoint(x: km, y: base + swing * sin(km * speed) + swing * 0.3 * cos(km * 3.1))
        }
    }

    static let curve: [ChartPoint<Double>] = [5.0, 15, 30, 60, 120, 300, 600, 1_200, 1_800, 3_600].map {
        ChartPoint(x: $0, y: 900 / pow($0, 0.28) + 120)
    }

    static let categories = [
        BarCategory(id: "walk", name: "Walk"), BarCategory(id: "ride", name: "Ride"),
        BarCategory(id: "swim", name: "Swim"),
    ]

    static var weeks: [BarGroup<Date>] {
        (0..<10).map { week in
            let x = Double(week)
            return BarGroup(
                x: start.addingTimeInterval(x * 7 * day),
                values: ["walk": 2 + sin(x) * 1.2, "ride": 3 + cos(x / 2) * 1.5, "swim": week % 3 == 0 ? 1 : 0],
                isPartial: week == 9,
                isMarked: week % 4 == 1
            )
        }
    }

    static let minutes: [Double] = [22, 25, 31, 34, 35, 38, 41, 42, 44, 45, 45, 47, 52, 55, 61, 64, 75, 90]

    static let splits: [WidthBar] = [1.0, 1, 1, 1, 0.4, 1, 1, 0.25].enumerated().map { index, width in
        WidthBar(id: "\(index)", width: width, value: 5.2 - sin(Double(index)) * 0.5 - (width < 1 ? 0.6 : 0))
    }

    static let profile = [
        ProfileSegment(id: 0, width: 600, start: 0.5, end: 0.75, level: 1),
        ProfileSegment(id: 1, width: 480, start: 1.0, level: 3),
        ProfileSegment(id: 2, width: 180, start: 0.55, level: 0),
        ProfileSegment(id: 3, width: 480, start: 1.0, level: 3),
        ProfileSegment(id: 4, width: 600, start: 0.5, level: 0),
    ]

    static let zones = [
        ZoneBarItem(name: "Z1", detail: "< 120", amount: 600, amountText: "10 min"),
        ZoneBarItem(name: "Z2", detail: "120–140", amount: 1_920, amountText: "32 min"),
        ZoneBarItem(name: "Z3", detail: "140–155", amount: 900, amountText: "15 min"),
        ZoneBarItem(name: "Z4", detail: "155–170", amount: 420, amountText: "7 min"),
        ZoneBarItem(name: "Z5", detail: "> 170", amount: 60, amountText: "1 min"),
    ]

    static var activeDays: [HeatmapDay] {
        (0..<110).compactMap { offset in
            let value = Double((offset * 37) % 90) - 20
            guard value > 0 else { return nil }
            return HeatmapDay(date: today.addingTimeInterval(-Double(offset) * day), value: value)
        }
    }

    static let tableColumns = [
        DataTableColumn("Date"), DataTableColumn("Place"), DataTableColumn("Distance", kind: .numeric),
        DataTableColumn("Time", kind: .numeric),
    ]

    static let tableRows = [
        DataTableRow(id: "1", cells: ["Oct 18", "River loop", DataTableCell("21.1 km", emphasized: true), "1:52:10"]),
        DataTableRow(id: "2", cells: ["Oct 15", "Park", "8.0 km", "41:05"]),
        DataTableRow(id: "3", cells: ["Oct 12", "Hill road", "12.4 km", "1:08:44"]),
    ]

    /// A made-up loop around a park.
    static let loop: [(latitude: Double, longitude: Double)] = (0...60).map { step in
        let angle = Double(step) / 60 * 2 * .pi
        return (47.37 + 0.012 * sin(angle) + 0.002 * sin(angle * 5), 8.54 + 0.02 * cos(angle))
    }
}
