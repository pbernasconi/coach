#if DEBUG
    import SwiftUI
    import WidgetKit

    extension RestActivityAttributes {
        nonisolated static let preview = RestActivityAttributes(exerciseName: "Back squat", setLabel: "Set 2")
        nonisolated static let longText = RestActivityAttributes(
            exerciseName: "Single-arm dumbbell row with a pause at the top",
            setLabel: "Set 2 to failure"
        )
    }

    extension RestActivityAttributes.ContentState {
        /// Preview only: ends `secondsLeft` after the canvas's own clock, so the countdown moves in the canvas.
        /// The app never does this; the Workout ViewModel gets `now` from the composition root.
        nonisolated static func preview(secondsLeft: Int, of total: Int, next: String?) -> Self {
            Self(endsAt: .now.addingTimeInterval(TimeInterval(secondsLeft)), totalSeconds: total, nextSetLabel: next)
        }

        nonisolated static var resting: Self { preview(secondsLeft: 75, of: 90, next: "Set 3 · 5 @ 100 kg") }
        nonisolated static var nextExercise: Self {
            preview(secondsLeft: 100, of: 120, next: "Romanian deadlift · Set 1 · 8 @ 60 kg")
        }
        nonisolated static var lastSet: Self { preview(secondsLeft: 20, of: 120, next: nil) }
    }

    #Preview("Lock Screen", as: .content, using: RestActivityAttributes.preview) {
        RestActivityWidget()
    } contentStates: {
        RestActivityAttributes.ContentState.resting
        RestActivityAttributes.ContentState.nextExercise
        RestActivityAttributes.ContentState.lastSet
    }

    #Preview("Island compact", as: .dynamicIsland(.compact), using: RestActivityAttributes.preview) {
        RestActivityWidget()
    } contentStates: {
        RestActivityAttributes.ContentState.resting
    }

    #Preview("Island expanded", as: .dynamicIsland(.expanded), using: RestActivityAttributes.preview) {
        RestActivityWidget()
    } contentStates: {
        RestActivityAttributes.ContentState.resting
        RestActivityAttributes.ContentState.lastSet
    }

    #Preview("Island minimal", as: .dynamicIsland(.minimal), using: RestActivityAttributes.preview) {
        RestActivityWidget()
    } contentStates: {
        RestActivityAttributes.ContentState.resting
    }

    #Preview("Lock Screen view, light") {
        RestLockScreenView(attributes: .preview, state: .resting)
            .preferredColorScheme(.light)
    }

    #Preview("Lock Screen view, dark") {
        RestLockScreenView(attributes: .preview, state: .nextExercise)
            .preferredColorScheme(.dark)
    }

    #Preview("Lock Screen view, long text, AX3") {
        RestLockScreenView(attributes: .longText, state: .nextExercise)
            .dynamicTypeSize(.accessibility3)
    }
#endif
