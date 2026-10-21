#if DEBUG
    import SwiftUI
    import WidgetKit

    extension WorkoutActivityAttributes {
        nonisolated static let preview = WorkoutActivityAttributes(
            sessionID: UUID(uuid: (0xA0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)),
            title: "Upper A"
        )
    }

    extension WorkoutActivitySet {
        nonisolated static let squat = WorkoutActivitySet(
            id: UUID(uuid: (0xC0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2)),
            exerciseName: "Back squat",
            title: "Set 2",
            weight: "100",
            unit: "kg",
            reps: "5"
        )
        nonisolated static let longName = WorkoutActivitySet(
            id: UUID(uuid: (0xC0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3)),
            exerciseName: "Single-arm dumbbell row with a pause at the top",
            title: "Set 3 to failure",
            weight: "32.5",
            unit: "kg",
            reps: "8–10"
        )
    }

    extension WorkoutActivityAttributes.ContentState {
        /// Preview only: a rest ending `secondsLeft` after the canvas's own clock, so the countdown moves in the canvas.
        /// The app never does this; the composition root owns the clock.
        nonisolated static func preview(
            set: WorkoutActivitySet? = .squat,
            secondsLeft: Int? = nil,
            of total: Int = 120
        ) -> Self {
            Self(
                current: set,
                exerciseNumber: 1,
                exerciseCount: 5,
                dots: [.done, .current, .planned, .planned],
                loggedSets: set == nil ? 18 : 1,
                totalSets: 18,
                rest: secondsLeft.map {
                    RestSnapshot(endsAt: .now.addingTimeInterval(TimeInterval($0)), totalSeconds: total)
                },
                nextExercise: "Romanian deadlift"
            )
        }

        nonisolated static var working: Self { preview() }
        nonisolated static var resting: Self { preview(secondsLeft: 84) }
        nonisolated static var restOver: Self { preview(secondsLeft: -12) }
        nonisolated static var longText: Self { preview(set: .longName, secondsLeft: 40) }
        nonisolated static var complete: Self { preview(set: nil) }
    }

    #Preview("Lock Screen", as: .content, using: WorkoutActivityAttributes.preview) {
        WorkoutActivityWidget()
    } contentStates: {
        WorkoutActivityAttributes.ContentState.working
        WorkoutActivityAttributes.ContentState.resting
        WorkoutActivityAttributes.ContentState.restOver
        WorkoutActivityAttributes.ContentState.longText
        WorkoutActivityAttributes.ContentState.complete
    }

    #Preview("Island expanded", as: .dynamicIsland(.expanded), using: WorkoutActivityAttributes.preview) {
        WorkoutActivityWidget()
    } contentStates: {
        WorkoutActivityAttributes.ContentState.working
        WorkoutActivityAttributes.ContentState.resting
        WorkoutActivityAttributes.ContentState.complete
    }

    #Preview("Island compact", as: .dynamicIsland(.compact), using: WorkoutActivityAttributes.preview) {
        WorkoutActivityWidget()
    } contentStates: {
        WorkoutActivityAttributes.ContentState.working
        WorkoutActivityAttributes.ContentState.resting
    }

    #Preview("Island minimal", as: .dynamicIsland(.minimal), using: WorkoutActivityAttributes.preview) {
        WorkoutActivityWidget()
    } contentStates: {
        WorkoutActivityAttributes.ContentState.working
        WorkoutActivityAttributes.ContentState.resting
    }

    #Preview("Lock Screen view, rest over, light") {
        WorkoutLockScreenView(attributes: .preview, state: .restOver, isStale: true)
            .preferredColorScheme(.light)
    }

    #Preview("Lock Screen view, resting, dark") {
        WorkoutLockScreenView(attributes: .preview, state: .resting, isStale: false)
            .preferredColorScheme(.dark)
    }

    #Preview("Lock Screen view, long text, AX3") {
        WorkoutLockScreenView(attributes: .preview, state: .longText, isStale: false)
            .dynamicTypeSize(.accessibility3)
    }
#endif
