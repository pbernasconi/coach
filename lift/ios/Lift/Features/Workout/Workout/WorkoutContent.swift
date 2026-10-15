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
                WorkoutBody(workout: workout, thumbnails: state.thumbnails, send: send)
            }
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .pinnedFooter(isPresented: state.rest != nil) {
            if let rest = state.rest {
                RestBar(rest: rest, onExtend: { send(.restExtendTapped) }, onSkip: { send(.restSkipTapped) })
            }
        }
        .koboSheet(
            item: Binding<SetEditor?>.action(state.editor) { if $0 == nil { send(.editorDismissed) } },
            title: \.title,
            hasChanges: state.editor?.hasChanges ?? false
        ) { editor in
            SetEditorFields(editor: editor, send: send)
        } footer: { _ in
            Button("Done") { send(.editorDoneTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }

    /// The session title in the inline navigation bar, which keeps the page compact.
    private var title: String {
        guard case .loaded(let workout) = state.workout else { return "" }
        return workout.title
    }
}

/// The loaded session: the day and progress on one compact line, then the exercises in order.
private struct WorkoutBody: View {
    @Environment(\.koboTheme) private var theme
    let workout: WorkoutOverview
    let thumbnails: [String: MediaImage]
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.xs) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                        dayText
                        Spacer(minLength: Space.sm)
                        setsText
                    }
                    VStack(alignment: .leading, spacing: Space.xxs) {
                        dayText
                        setsText
                    }
                }
                SegmentedProgress(done: workout.loggedSets, goal: workout.totalSets, accessibilityLabel: "Sets logged")
            }
            ForEach(workout.exercises) { exercise in
                WorkoutExerciseSection(
                    exercise: exercise,
                    thumbnail: exercise.catalogID.map { thumbnails[$0] ?? .loading },
                    send: send
                )
            }
        }
        .pageGutter()
        .padding(.top, Space.sm)
        .padding(.bottom, Space.xxl)
    }

    private var dayText: some View {
        Text(verbatim: workout.dayTitle)
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(theme.palette.accentText)
    }

    private var setsText: some View {
        Text(verbatim: SessionText.sets(logged: workout.loggedSets, total: workout.totalSets))
            .font(theme.font(.subheadline).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
    }
}

/// Last time's values, the weight and reps steppers and "Apply to later sets" in the editor sheet. Done (in the sheet
/// footer) saves; it never logs the set.
private struct SetEditorFields: View {
    @Environment(\.koboTheme) private var theme
    let editor: SetEditor
    let send: (WorkoutAction) -> Void

    var body: some View {
        if let lastTime = editor.lastTime {
            Label {
                Text(verbatim: lastTime)
            } icon: {
                Image(systemName: "clock.arrow.circlepath").accessibilityHidden(true)
            }
            .font(theme.font(.subheadline).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
        }
        StepperField(
            verbatim: String(localized: "Weight"),
            value: .action(editor.weight) { send(.editorWeightChanged($0)) },
            in: 0...500,
            step: editor.step,
            unit: editor.unit.rawValue
        )
        StepperField("Reps", value: .action(editor.reps) { send(.editorRepsChanged($0)) }, in: 0...100)
        if editor.laterSets > 0 {
            ToggleRow(
                "Apply to later sets",
                subtitle: "New weight on the next ^[\(editor.laterSets) planned set](inflect: true)",
                systemImage: "arrow.down.to.line",
                isOn: .action(editor.appliesToLater) { send(.editorApplyToLaterChanged($0)) }
            )
        }
    }
}
