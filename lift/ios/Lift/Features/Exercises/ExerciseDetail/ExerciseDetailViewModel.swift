import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class ExerciseDetailViewModel {
    /// How many past sessions "Your history" lists.
    static let historyLimit = 5

    private(set) var state = ExerciseDetailState()

    private let exerciseID: UUID
    private let exercises: any ExerciseRepository
    private let history: any ExerciseHistoryRepository
    private let days: DayCalendar
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        exerciseID: UUID,
        exercises: any ExerciseRepository,
        history: any ExerciseHistoryRepository,
        calendar: Calendar
    ) {
        self.exerciseID = exerciseID
        self.exercises = exercises
        self.history = history
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes the exercise and its history; started by the Screen's `.task` (SCR-4).
    func run() async {
        async let library: Void = observeExercise()
        async let past: Void = observeHistory()
        _ = await (library, past)
    }

    @discardableResult
    func send(_ action: ExerciseDetailAction) -> Task<Void, Never>? {
        switch action {
        case .videosTapped:
            guard case .loaded(let item) = state.exercise, let url = item.videoURL else { return nil }
            serial += 1
            state.link = LinkRequest(serial: serial, url: url)
        }
        return nil
    }

    private func observeExercise() async {
        for await library in exercises.observeExercises() {
            if let exercise = library.first(where: { $0.id == exerciseID }) {
                state.exercise = .loaded(ExerciseDetailItem(exercise: exercise))
            } else {
                state.exercise = .empty
            }
        }
    }

    private func observeHistory() async {
        for await entries in history.observeHistory(exerciseID: exerciseID, limit: Self.historyLimit) {
            let rows = entries.map { ExerciseHistoryRow(entry: $0, days: days) }
            state.history = rows.isEmpty ? .empty : .loaded(rows)
        }
    }
}
