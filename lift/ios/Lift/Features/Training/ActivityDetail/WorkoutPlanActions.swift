import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// What a planned workout lets you do on the page: "Start workout" when the coach listed exercises (a Lift session
/// with them, to log each set). Mark done and Not done live in the bar's "…" (`WorkoutDoneMenu`); a failed write
/// shows its message here. Nothing once a Lift session or an activity completed it.
struct WorkoutPlanActions: View {
    @Environment(\.koboTheme) private var theme
    let workout: AppPlannedWorkout
    let write: PlanWrite
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        // Nothing at all when there's no button and no error, so the page keeps no empty gap under the header.
        if workout.liftSessionId == nil, workout.done?.activityId == nil, canStart || write.failure != nil {
            VStack(alignment: .leading, spacing: Space.sm) {
                buttons
                if let message = write.failure {
                    Text(verbatim: message)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.danger.ink)
                }
            }
        }
    }

    @ViewBuilder private var buttons: some View {
        if canStart {
            Button("Start workout", systemImage: "figure.strengthtraining.traditional") {
                send(.startWorkoutTapped)
            }
            .buttonStyle(.kobo(.primary))
            .disabled(write.isRunning)
        }
    }

    private var canStart: Bool { workout.state != "done" && !(workout.exercises ?? []).isEmpty }
}

/// The coach's exercises, one row each: the name, its sets × reps, and the coach's words for it.
struct PlannedExercisesCard: View {
    @Environment(\.koboTheme) private var theme
    let exercises: [PlannedExercise]

    var body: some View {
        CardSection("Exercises") {
            ForEach(exercises) { exercise in
                VStack(alignment: .leading, spacing: Space.xxs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: exercise.name)
                            .font(theme.font(.subheadline).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                        Spacer(minLength: Space.sm)
                        Text(verbatim: Self.setsText(exercise))
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textPrimary)
                    }
                    if let note = exercise.note {
                        Text(verbatim: note)
                            .font(theme.font(.footnote))
                            .foregroundStyle(theme.palette.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    /// "3 × 15", or "3 × 8–10".
    static func setsText(_ exercise: PlannedExercise) -> String {
        let reps = exercise.repsMax.map { "\(exercise.reps)–\($0)" } ?? "\(exercise.reps)"
        return "\(exercise.sets) × \(reps)"
    }
}
