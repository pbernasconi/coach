import Foundation
import LiftSync

/// Everything the weigh-in screen renders (SCR-6).
nonisolated struct WeighInState: Equatable, Sendable {
    /// `GET /api/app/weigh-ins/{day}`, with how fresh it is.
    var weighIn = AppResourceState<AppWeighIn>()
    /// The readings and the trend line, once loaded; nil with fewer than two readings.
    var chart: WeighInChart?
    /// "7:12 AM": when the scale sent today's reading, in the phone's time zone.
    var timeText: String?
    /// The earlier and the later weigh-in, once loaded; either is left out at the ends.
    var neighbours: [WeighInNeighbour] = []
}

/// A row that opens the weigh-in of another day.
nonisolated struct WeighInNeighbour: Identifiable, Equatable, Sendable {
    enum Side: String, Sendable {
        case earlier
        case later
    }

    let side: Side
    let day: PlainDay
    /// "Wed, Oct 21".
    let dayText: String

    var id: Side { side }
}
