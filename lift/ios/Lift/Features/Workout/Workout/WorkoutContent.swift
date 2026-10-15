import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the session header, one section per exercise, the rest bar and the set editor (SCR-2).
struct WorkoutContent: View {
    let state: WorkoutState
    let send: (WorkoutAction) -> Void

    var body: some View {
        ScrollView {
            switch state.workout {
            case .loading:
                LoadingState()
                    .pageGutter()
            case .empty:
                EmptyState(
                    symbol: "figure.strengthtraining.traditional",
                    title: "Workout not found",
                    message: "It may have been removed or moved."
                )
                .pageGutter()
            case .failed:
                ErrorState(title: "Workout could not be loaded")
                    .pageGutter()
            case .loaded(let workout):
                WorkoutBody(workout: workout, send: send)
            }
        }
        .screenCanvas()
        .navigationBarTitleDisplayMode(.inline)
        .pinnedFooter(isPresented: state.rest != nil) {
            if let rest = state.rest {
                RestBar(rest: rest, onExtend: { send(.restExtendTapped) }, onSkip: { send(.restSkipTapped) })
            }
        }
        .koboSheet(
            item: .action(state.editor) { if $0 == nil { send(.editorDismissed) } },
            title: \.title,
            hasChanges: state.editor?.hasChanges ?? false
        ) { editor in
            SetEditorFields(editor: editor, send: send)
        } footer: { _ in
            Button("Done") { send(.editorDoneTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }
}

/// The loaded session: header with progress, then the exercises in order.
private struct WorkoutBody: View {
    @Environment(\.koboTheme) private var theme
    let workout: WorkoutOverview
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AppHeader(verbatim: workout.title, kicker: workout.dayTitle)
            VStack(alignment: .leading, spacing: Space.xxl) {
                HStack(spacing: Space.md) {
                    SegmentedProgress(
                        done: workout.loggedSets,
                        goal: workout.totalSets,
                        accessibilityLabel: "Sets logged"
                    )
                    Text(verbatim: SessionText.sets(logged: workout.loggedSets, total: workout.totalSets))
                        .font(theme.font(.subheadline).monospacedDigit())
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize()
                }
                ForEach(workout.exercises) { exercise in
                    WorkoutExerciseSection(exercise: exercise, send: send)
                }
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
    }
}

/// The weight and reps steppers in the editor sheet. Done (in the sheet footer) saves; it never logs the set.
private struct SetEditorFields: View {
    let editor: SetEditor
    let send: (WorkoutAction) -> Void

    var body: some View {
        StepperField(
            verbatim: String(localized: "Weight"),
            value: .action(editor.weight) { send(.editorWeightChanged($0)) },
            in: 0...500,
            step: editor.step,
            unit: editor.unit.rawValue
        )
        StepperField("Reps", value: .action(editor.reps) { send(.editorRepsChanged($0)) }, in: 0...100)
    }
}
