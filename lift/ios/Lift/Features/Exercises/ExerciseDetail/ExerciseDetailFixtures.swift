#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension ExerciseDetailState {
        private static func item(seed number: UInt8) -> ExerciseDetailItem {
            let exercise = ExerciseLibrary.seed.first { $0.id == ExerciseLibrary.seedID(number) }
            return exercise.map(ExerciseDetailItem.init(exercise:))
                ?? ExerciseDetailItem(name: "?", equipment: "", primary: [], secondary: [], guide: nil, videoURL: nil)
        }

        private static let history: [ExerciseHistoryRow] = [
            ExerciseHistoryRow(
                id: .fixture(1),
                dayTitle: "Thursday, 5 March",
                best: "5 @ 102.5 kg",
                sets: "3 sets",
                estimate: "Est. 1RM 119.5 kg"
            ),
            ExerciseHistoryRow(
                id: .fixture(2),
                dayTitle: "Monday, 2 March",
                best: "5 @ 100 kg",
                sets: "3 sets",
                estimate: "Est. 1RM 116.5 kg"
            ),
            ExerciseHistoryRow(
                id: .fixture(3),
                dayTitle: "Thursday, 26 February",
                best: "6 @ 97.5 kg",
                sets: "4 sets",
                estimate: "Est. 1RM 117 kg"
            ),
        ]

        static let fixtureDefault = ExerciseDetailState(exercise: .loaded(item(seed: 1)), history: .loaded(history))
        static let fixtureWithMedia = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(history),
            media: URL(string: "https://example.com/squat.gif").flatMap { gif in
                URL(string: "https://example.com/squat.png").map { thumbnail in
                    ExerciseMedia(gifURL: gif, thumbnailURL: thumbnail, attribution: "Made-up credit line")
                }
            },
            animation: MediaPreviewData.still
        )
        static let fixtureCatalogAdded = ExerciseDetailState(
            exercise: .loaded(
                ExerciseDetailItem(
                    name: "Made-Up Cable Row",
                    equipment: "Cable",
                    primary: ["Back"],
                    secondary: ["Biceps"],
                    guide: nil,
                    videoURL: ExerciseGuide.videoSearchURL(for: "Made-up cable row technique")
                )
            ),
            history: .empty,
            animation: .failed,
            librarySteps: ["Sit tall and grab the handle.", "Pull it to your waist.", "Let it back out slowly."],
            isLibraryStepsExpanded: true
        )
        static let fixtureNoHistory = ExerciseDetailState(exercise: .loaded(item(seed: 4)), history: .empty)
        static let fixtureCustom = ExerciseDetailState(
            exercise: .loaded(
                ExerciseDetailItem(
                    name: "Landmine press",
                    equipment: "Barbell",
                    primary: ["Shoulders"],
                    secondary: ["Triceps", "Chest"],
                    guide: nil,
                    videoURL: ExerciseGuide.videoSearchURL(for: "Landmine press technique")
                )
            ),
            history: .empty
        )
        static let fixtureLoading = ExerciseDetailState(exercise: .loading)
        static let fixtureEmpty = ExerciseDetailState(exercise: .empty)
        static let fixtureFailed = ExerciseDetailState(exercise: .failed(.unknown))
        static let fixtureHistoryLoading = ExerciseDetailState(exercise: .loaded(item(seed: 17)), history: .loading)
    }
#endif
