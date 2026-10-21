import Foundation

/// The analysis streams on two shared x axes (300 buckets, smoothed on the server).
nonisolated struct ActivityAnalysis: Decodable, Equatable, Sendable {
    nonisolated struct Axes: Decodable, Equatable, Sendable {
        /// Empty without a distance stream (`null` on the wire).
        var distanceKm: [Double]
        var timeS: [Double]

        private enum Keys: String, CodingKey { case distanceKm, timeS }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: Keys.self)
            distanceKm = try container.decodeIfPresent([Double].self, forKey: .distanceKm) ?? []
            timeS = try container.decode([Double].self, forKey: .timeS)
        }
    }

    nonisolated struct Stream: Decodable, Equatable, Sendable {
        var key: String
        var label: String
        var unit: String
        /// `nil` is a gap in the line.
        var values: [Double?]
        var avgText: String?
        /// Larger values lower down (pace: faster is higher).
        var invert: Bool
        /// Drawn on top of that stream's panel (GAP over pace).
        var overlayOf: String?
        /// Filled below the line (elevation).
        var area: Bool

        private enum Keys: String, CodingKey { case key, label, unit, values, avgText, invert, overlayOf, area }

        /// `invert` and `area` are sent only when true.
        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: Keys.self)
            key = try container.decode(String.self, forKey: .key)
            label = try container.decode(String.self, forKey: .label)
            unit = try container.decode(String.self, forKey: .unit)
            values = try container.decode([Double?].self, forKey: .values)
            avgText = try container.decodeIfPresent(String.self, forKey: .avgText)
            invert = try container.decodeIfPresent(Bool.self, forKey: .invert) ?? false
            overlayOf = try container.decodeIfPresent(String.self, forKey: .overlayOf)
            area = try container.decodeIfPresent(Bool.self, forKey: .area) ?? false
        }
    }

    var note: String?
    var emptyText: String?
    var x: Axes?
    var streams: [Stream]
}

/// The pace (or speed) bars, in the web's toggle order: splits, laps, smoothed.
nonisolated struct ActivityPaceBars: Decodable, Equatable, Sendable {
    nonisolated struct Bar: Decodable, Equatable, Sendable {
        var label: String
        /// Meters (seconds for a lap without distance); nil when the lap has neither.
        var width: Double?
        /// m/s: faster is taller; nil for a part with no speed (a lap without `average_speed`, a split not moving).
        var value: Double?
        var valueText: String
        var gap: Double?
        var gapText: String?
        var timeText: String?
        var distanceText: String?
        var hrText: String?
    }

    nonisolated struct Mode: Decodable, Equatable, Sendable {
        var key: String
        var avg: Double?
        var avgText: String?
        var gapAvgText: String?
        /// Splits and laps; empty for the smoothed mode.
        var bars: [Bar]
        /// The smoothed mode: speed (m/s) over time; empty for the others.
        var timeS: [Double]
        var values: [Double?]
        /// Empty without GAP.
        var gapValues: [Double?]

        private enum Keys: String, CodingKey { case key, avg, avgText, gapAvgText, bars, timeS, values, gapValues }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: Keys.self)
            key = try container.decode(String.self, forKey: .key)
            avg = try container.decodeIfPresent(Double.self, forKey: .avg)
            avgText = try container.decodeIfPresent(String.self, forKey: .avgText)
            gapAvgText = try container.decodeIfPresent(String.self, forKey: .gapAvgText)
            bars = try container.decodeIfPresent([Bar].self, forKey: .bars) ?? []
            timeS = try container.decodeIfPresent([Double].self, forKey: .timeS) ?? []
            values = try container.decodeIfPresent([Double?].self, forKey: .values) ?? []
            gapValues = try container.decodeIfPresent([Double?].self, forKey: .gapValues) ?? []
        }
    }

    var title: String
    var unit: String
    var hasGap: Bool
    var modes: [Mode]
}

/// Moving time per 15 s of pace, fastest first.
nonisolated struct ActivityPaceHistogram: Decodable, Equatable, Sendable {
    nonisolated struct Bin: Decodable, Equatable, Sendable {
        var fromS: Double
        var toS: Double
        var label: String
        var seconds: Double
        var timeText: String
        var percent: Int
    }

    var note: String?
    var unit: String
    var bins: [Bin]
    var avgIndex: Int?
    var avgText: String?
}

nonisolated struct ActivityRelativeEffort: Decodable, Equatable, Sendable {
    var stats: [LabelledValue]
    var note: String?
}

/// Heart-rate or power zones, Z1 first; the percentages add up to 100.
nonisolated struct ActivityZones: Decodable, Equatable, Sendable {
    nonisolated struct Zone: Decodable, Equatable, Sendable {
        var zone: Int
        var name: String
        var rangeText: String
        var timeText: String
        var seconds: Double
        var percent: Int
    }

    var note: String?
    var zones: [Zone]
}

/// The power curve (best average watts per duration) against FTP, and the power zones.
nonisolated struct ActivityPower: Decodable, Equatable, Sendable {
    nonisolated struct Point: Decodable, Equatable, Sendable {
        var seconds: Double
        var label: String
        var durationText: String
        var watts: Double
        var wattsText: String
    }

    var ftp: Double?
    var ftpText: String?
    var curve: [Point]
    var zones: [ActivityZones.Zone]
}
