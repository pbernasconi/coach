#if DEBUG
    import Foundation
    import LiftCore
    import LiftSync

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
                dayTitle: "Thu 5 Mar",
                best: "5 @ 102.5 kg",
                sets: "3 sets",
                estimate: "Est. 1RM 119.5 kg"
            ),
            ExerciseHistoryRow(
                id: .fixture(2),
                dayTitle: "Mon 2 Mar",
                best: "5 @ 100 kg",
                sets: "3 sets",
                estimate: "Est. 1RM 116.5 kg"
            ),
            ExerciseHistoryRow(
                id: .fixture(3),
                dayTitle: "Thu 26 Feb",
                best: "6 @ 97.5 kg",
                sets: "4 sets",
                estimate: "Est. 1RM 117 kg"
            ),
        ]

        static let fixtureDefault = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(history),
            progress: .fixtureWeekly
        )
        static let fixtureProgressSelected = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(history),
            progress: .fixtureSelected
        )
        static let fixtureProgressSingle = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(Array(history.prefix(1))),
            progress: .fixtureSingle
        )
        static let fixtureProgressEmptyRange = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(Array(history.suffix(1))),
            progress: .fixtureEmptyRange
        )
        static let fixtureWithMedia = ExerciseDetailState(
            exercise: .loaded(item(seed: 1)),
            history: .loaded(history),
            progress: .fixtureWeekly,
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
        /// The coach's numbers (the bundled demo body) over a library exercise: they replace the local chart and history.
        static var fixtureServer: ExerciseDetailState {
            var state = fixtureWithMedia
            state.withServer()
            return state
        }
        /// The touched chart point shows its label and "View session".
        static var fixtureServerTouched: ExerciseDetailState {
            var state = fixtureServer
            state.serverPoint = state.serverChart.last
            return state
        }
        /// An exercise only the coach knows (a `name-…` key): the coach's numbers alone.
        static var fixtureServerOnly: ExerciseDetailState {
            var state = ExerciseDetailState(exercise: .empty, history: .empty)
            state.withServer()
            return state
        }
        static let fixtureLoading = ExerciseDetailState(exercise: .loading)
        static let fixtureEmpty = ExerciseDetailState(exercise: .empty)
        static let fixtureFailed = ExerciseDetailState(exercise: .failed(.unknown))
        static let fixtureHistoryLoading = ExerciseDetailState(exercise: .loaded(item(seed: 17)), history: .loading)
    }

    extension ExerciseDetailState {
        /// Puts the bundled demo body in `server`, with its chart points in the current calendar.
        fileprivate mutating func withServer() {
            guard let stats = LiftDemoBodies.exercise else { return }
            server = AppResourceState(
                content: .loaded(stats),
                freshness: AppFreshness(text: "Updated 9:41 AM", isOffline: false)
            )
            serverChart = ExerciseServerPoint.points(
                stats.chart.value?.points ?? [],
                days: DayCalendar(calendar: Calendar(identifier: .gregorian))
            )
        }
    }
#endif
