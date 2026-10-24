import Foundation

/// `route.colored` (lift/APP-API.md): the route's points along the streams, and for each metric the colour bin of
/// every point. The server picks the metrics, their order, colours and legend text.
nonisolated struct ActivityRouteColors: Decodable, Equatable, Sendable {
    nonisolated struct Metric: Decodable, Equatable, Sendable, Identifiable {
        /// `pace`, `gap`, `speed`, `hr`, `hrZones`, `power`, `powerZones`, `elevation`, `grade`, `cadence`.
        var key: String
        var label: String
        var unit: String
        /// `#rrggbb`, the low end of the scale first.
        var colors: [String]
        /// An index into `colors` per point.
        var bins: [Int?]
        var lowText: String
        var highText: String

        var id: String { key }

        /// The SF Symbol in the colour menu.
        var symbol: String {
            switch key {
            case "pace", "gap", "speed": "speedometer"
            case "hr": "heart"
            case "hrZones": "heart.text.square"
            case "power": "bolt"
            case "powerZones": "bolt.square"
            case "elevation": "mountain.2"
            case "grade": "arrow.up.right"
            case "cadence": "metronome"
            default: "paintpalette"
            }
        }
    }

    /// One run of the line in one colour. Each piece starts where the one before ends, so the line has no gaps.
    nonisolated struct Piece: Sendable, Identifiable {
        var id: Int
        /// `#rrggbb`; nil for a point without a value.
        var color: String?
        var coordinates: [(latitude: Double, longitude: Double)]
    }

    var points: [[Double]]
    var metrics: [Metric]

    func metric(_ key: String?) -> Metric? {
        guard let key else { return nil }
        return metrics.first { $0.key == key }
    }

    /// The line cut where the metric's colour changes.
    func pieces(for metric: Metric) -> [Piece] {
        var pieces: [Piece] = []
        var lastBin: Int?
        for (index, pair) in points.enumerated() where pair.count == 2 {
            let point = (latitude: pair[0], longitude: pair[1])
            let bin = metric.bins.indices.contains(index) ? metric.bins[index] : nil
            if !pieces.isEmpty, bin == lastBin {
                pieces[pieces.count - 1].coordinates.append(point)
            } else {
                let start = pieces.last?.coordinates.last.map { [$0, point] } ?? [point]
                let color = bin.flatMap { metric.colors.indices.contains($0) ? metric.colors[$0] : nil }
                pieces.append(Piece(id: pieces.count, color: color, coordinates: start))
            }
            lastBin = bin
        }
        return pieces.filter { $0.coordinates.count > 1 }
    }
}
