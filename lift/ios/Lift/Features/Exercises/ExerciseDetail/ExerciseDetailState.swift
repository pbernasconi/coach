import Foundation
import LiftCore
import LiftSync

/// Everything the exercise detail screen renders. Exclusive states are enums (SCR-6).
nonisolated struct ExerciseDetailState: Equatable, Sendable {
    /// The library exercise; `.empty` once it is removed or if it never existed.
    var exercise: Loadable<ExerciseDetailItem> = .loading
    /// The last logged sessions of this exercise, newest first.
    var history: Loadable<[ExerciseHistoryRow]> = .loading
    /// Estimated one-rep max and heaviest set per session, over the chosen range.
    var progress = ExerciseProgressState()
    /// The animation shown at the top; nil until media is known for this exercise.
    var media: ExerciseMedia?
    /// The loaded animation behind `media`.
    var animation: MediaImage = .loading
    /// The catalog's steps, for an exercise with no authored guide (one added from the catalog); empty otherwise.
    var librarySteps: [String] = []
    /// Whether "From the exercise library" is open.
    var isLibraryStepsExpanded = false
    /// The latest page to open (technique videos).
    var link: LinkRequest?
    /// The coach's numbers for this exercise (`/api/app/lift/exercises/{key}`).
    var server = AppResourceState<LiftExerciseStats>()
    /// The coach's e1RM per session as chart points, oldest first.
    var serverChart: [ExerciseServerPoint] = []
    /// The last touched point of the coach's chart; its label and a link to its session show under the chart.
    var serverPoint: ExerciseServerPoint?
    /// Whether the coach's sessions after the first `ExerciseServerSections.shownSessions` are open.
    var isServerSessionsExpanded = false

    /// The coach's numbers once they loaded with their chart. They are the source of truth then: the local progress
    /// chart and history hide, so there are never two competing charts. Nil while loading, offline with nothing kept,
    /// not connected, or when the chart part failed; the local sections show then.
    var serverStats: LiftExerciseStats? {
        guard let stats = server.content.value, stats.chart.value != nil else { return nil }
        return stats
    }
}

/// One session on the coach's e1RM chart.
nonisolated struct ExerciseServerPoint: Equatable, Sendable, Identifiable {
    var date: Date
    var e1rm: Double
    var sessionID: String
    /// "Tue, Sep 29, 2026: 60 lb est. 1RM (45 lb x 10)".
    var label: String

    /// The session, since two sessions can fall on one day.
    var id: String { sessionID }
}

/// The exercise as the detail screen shows it.
nonisolated struct ExerciseDetailItem: Equatable, Sendable {
    var name: String
    /// "Barbell".
    var equipment: String
    /// "Quads", "Glutes".
    var primary: [String]
    var secondary: [String]
    /// How to do it; nil for an exercise the person created.
    var guide: ExerciseGuide?
    /// The pinned or searched technique videos.
    var videoURL: URL?

    init(
        name: String,
        equipment: String,
        primary: [String],
        secondary: [String],
        guide: ExerciseGuide?,
        videoURL: URL?
    ) {
        self.name = name
        self.equipment = equipment
        self.primary = primary
        self.secondary = secondary
        self.guide = guide
        self.videoURL = videoURL
    }

    init(exercise: Exercise) {
        let guide = ExerciseGuide.for(id: exercise.id)
        self.init(
            name: exercise.name,
            equipment: ExerciseText.equipment(exercise.equipment),
            primary: exercise.primary.map(ExerciseText.muscle),
            secondary: exercise.secondary.map(ExerciseText.muscle),
            guide: guide,
            videoURL: guide?.videoURL ?? ExerciseGuide.videoSearchURL(for: "\(exercise.name) technique")
        )
    }
}

/// One past session in "Your history".
nonisolated struct ExerciseHistoryRow: Equatable, Sendable, Identifiable {
    /// The session id.
    var id: UUID
    /// "Thursday, 5 March".
    var dayTitle: String
    /// The best set: "5 @ 100 kg".
    var best: String
    /// "3 sets".
    var sets: String
    /// "Est. 1RM 116.7 kg"; nil when it cannot be estimated (more than 12 reps, no load).
    var estimate: String?
}
