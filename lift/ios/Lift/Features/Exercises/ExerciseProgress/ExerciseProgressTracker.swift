import Foundation
import LiftCore
import LiftStore

/// The progress chart's working state, shared by the exercise and catalog detail ViewModels: every charted session,
/// the range and the touched session. Each change rebuilds `state` for the screen.
nonisolated struct ExerciseProgressTracker: Sendable {
    /// How many past sessions the chart reads: every one, in practice.
    static let sessionLimit = 2_000

    private let builder: ExerciseProgressBuilder
    private let unit: WeightUnit
    private var points: [ProgressPoint] = []
    private var selectedID: UUID?
    private(set) var state = ExerciseProgressState()

    init(days: DayCalendar, unit: WeightUnit) {
        builder = ExerciseProgressBuilder(days: days, unit: unit)
        self.unit = unit
    }

    /// New history from the repository, newest first.
    mutating func show(_ entries: [ExerciseHistoryEntry], today: LocalDay) {
        points = ExerciseProgress.points(entries.map(\.progressSession), unit: unit)
        if !points.contains(where: { $0.id == selectedID }) { selectedID = nil }
        rebuild(today: today)
    }

    /// The range picker changed; any touched session is let go.
    mutating func select(range: ProgressRange, today: LocalDay) {
        state.range = range
        selectedID = nil
        rebuild(today: today)
    }

    /// The chart was touched at `date`, or let go (nil).
    mutating func select(date: Date?, today: LocalDay) {
        selectedID = date.flatMap { builder.nearestID(to: $0, in: points, range: state.range, today: today) }
        rebuild(today: today)
    }

    private mutating func rebuild(today: LocalDay) {
        state.chart = builder.chart(points, range: state.range, selectedID: selectedID, today: today)
    }
}
