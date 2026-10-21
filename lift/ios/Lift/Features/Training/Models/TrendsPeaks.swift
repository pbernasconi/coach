import Foundation

/// The best efforts by duration (power) and distance (run), all time and in the last 90 and 28 days.
nonisolated struct TrendsPeaks: Decodable, Equatable, Sendable {
    nonisolated struct Window: Decodable, Equatable, Sendable, Hashable {
        /// `all | d90 | d28`.
        var key: String
        var label: String
    }

    nonisolated struct Cell: Decodable, Equatable, Sendable {
        var text: String
        /// The run pace under the time ("4:27"), or `nil`.
        var subText: String?
        var dateText: String
        /// Opens `/api/app/activities/{id}`.
        var activityId: String
        var name: String?
        /// The all-time best: bold.
        var best: Bool
    }

    nonisolated struct Row: Decodable, Equatable, Sendable {
        var span: Double
        var label: String
        /// Window key to cell; `nil` when there was no effort in that window.
        var cells: [String: Cell?]
    }

    nonisolated struct Table: Decodable, Equatable, Sendable {
        var title: String
        var unitText: String
        /// No data yet.
        var empty: Bool
        var rows: [Row]
    }

    var note: String?
    var windows: [Window]
    var power: Table
    var run: Table
}
