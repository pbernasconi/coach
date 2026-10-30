import Foundation

/// Made-up snapshots: the widget's placeholder and gallery preview, and the app's demo gallery (`-open widgets`).
extension HomeWidgetSnapshot {
    /// A lift and an easy spin, the lift done.
    nonisolated static let sample = HomeWidgetSnapshot(
        day: "2026-10-30",
        load: Load(fitness: 67, form: 19, fatigue: 42),
        workouts: [
            Workout(
                id: "sample-lift",
                title: "Heavy barbell lift",
                sport: "strength",
                detail: "07:00 · 1:15",
                isDone: true,
                liftSessionID: nil
            ),
            Workout(
                id: "sample-spin",
                title: "Easy spin",
                sport: "ride",
                detail: "18:00 · 45m",
                isDone: false,
                liftSessionID: nil
            ),
        ],
        emptyText: nil
    )

    /// Nothing planned today.
    nonisolated static let restDay = HomeWidgetSnapshot(
        day: "2026-10-30",
        load: Load(fitness: 67, form: -4, fatigue: 71),
        workouts: [],
        emptyText: nil
    )
}
