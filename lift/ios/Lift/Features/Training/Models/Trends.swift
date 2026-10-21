import Foundation
import LiftSync

/// `GET /api/app/trends` (lift/APP-API.md, "Trends"): the web's Trends page. Each section loads on its own.
nonisolated struct TrendsResponse: Decodable, Equatable, Sendable {
    static let path = "api/app/trends"

    var performance: AppSection<TrendsPerformance>
    var ramp: AppSection<TrendsRamp>
    var peaks: AppSection<TrendsPeaks>
    var lift: AppSection<TrendsLift>

    private enum Keys: String, CodingKey { case performance, ramp, peaks, lift }

    /// A missing or broken section fails alone.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        performance = container.section(.performance)
        ramp = container.section(.ramp)
        peaks = container.section(.peaks)
        lift = container.section(.lift)
    }
}

nonisolated struct TrendsPerformance: Decodable, Equatable, Sendable {
    nonisolated struct Tile: Decodable, Equatable, Sendable {
        nonisolated struct Delta: Decodable, Equatable, Sendable {
            var text: String
            /// `up` (green) or `down` (red).
            var tone: AppTone
        }

        nonisolated struct Spark: Decodable, Equatable, Sendable {
            var values: [Double]
        }

        var key: String
        var label: String
        var valueText: String
        var sport: String?
        var delta: Delta?
        var footText: String?
        var spark: Spark?
    }

    nonisolated struct WeeklyHours: Decodable, Equatable, Sendable {
        nonisolated struct SportName: Decodable, Equatable, Sendable {
            var id: String
            var label: String
        }

        nonisolated struct Week: Decodable, Equatable, Sendable {
            var week: String
            var label: String
            /// The week in progress: drawn lighter, left out of the average.
            var current: Bool
            var hours: Double
            var sports: [TrendsWeekPart]
            /// Strength days: a dot under the bar.
            var strength: Int
        }

        var sports: [SportName]
        var average: Double?
        var averageText: String?
        var weeks: [Week]
    }

    nonisolated struct TableRow: Decodable, Equatable, Sendable {
        var week: String
        var current: Bool
        var label: String
        var hoursText: String
        var runKmText: String
        var runPaceText: String
        var rideKmText: String
        var strengthText: String
        var tssText: String
        var planText: String
    }

    var staleText: String?
    var tiles: [Tile]
    var weeklyHours: WeeklyHours
    var table: [TableRow]
}

/// One sport's hours in a week of the weekly-hours chart.
nonisolated struct TrendsWeekPart: Decodable, Equatable, Sendable {
    var id: String
    var hours: Double
}

nonisolated struct TrendsRamp: Decodable, Equatable, Sendable {
    nonisolated struct Rate: Decodable, Equatable, Sendable {
        var days: Int
        var label: String
        var changeText: String
        var perWeekText: String?
        var levelText: String
        /// High or aggressive: the web adds "▲" and red.
        var warn: Bool
    }

    var rates: [Rate]
    var note: String?
}

nonisolated struct TrendsLift: Decodable, Equatable, Sendable {
    nonisolated struct Muscles: Decodable, Equatable, Sendable {
        nonisolated struct Row: Decodable, Equatable, Sendable {
            var muscle: String
            var label: String
            var week: Double
            var weekText: String
            var avg: Double
            var avgText: String
            /// `below | inRange | above`.
            var status: String
            var statusText: String
        }

        var band: AppBand
        var note: String?
        var rows: [Row]
    }

    var hasData: Bool
    var emptyText: String?
    var muscles: Muscles?
    var mainLifts: [AppMainLift]
}
