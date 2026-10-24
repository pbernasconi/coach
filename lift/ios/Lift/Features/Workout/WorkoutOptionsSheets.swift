import KoboComponents
import KoboTokens
import SwiftUI

extension View {
    /// The workout's pause button and "…" in the navigation bar, and the two options sheets: the workout's (Reorder
    /// exercises, Add or Edit note, Workout settings, Save as template, Discard workout) and one exercise's (Add set,
    /// Add or Edit note, Move up, Move down, Remove). Every choice applies at once; removing and discarding offer Undo
    /// in a toast instead of asking first (product rule).
    func workoutOptions(state: WorkoutState, send: @escaping (WorkoutAction) -> Void) -> some View {
        modifier(WorkoutOptionsSheets(state: state, send: send))
    }
}

/// Keeps the last options while a sheet slides away, so its rows do not empty out during the dismissal; that copy is
/// presentation state only.
private struct WorkoutOptionsSheets: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let state: WorkoutState
    let send: (WorkoutAction) -> Void
    @State private var shown: WorkoutOptions?

    func body(content: Content) -> some View {
        content
            .toolbar {
                if case .loaded(let workout) = state.workout, workout.startedAt != nil, !workout.isFinished {
                    ToolbarItem(placement: .topBarTrailing) {
                        // Pause up top; once paused it resumes (orange), and the dock offers Finish.
                        if workout.isPaused {
                            // The on-accent ink, as on the dock's Resume: the system's pale ink is faint on orange.
                            // The toolbar ignores a plain foregroundStyle; a palette-rendered symbol keeps it.
                            Button {
                                send(.resumeTapped)
                            } label: {
                                Image(systemName: "play.fill")
                                    .symbolRenderingMode(.palette)
                                    .foregroundStyle(theme.palette.onAccent)
                                    .accessibilityLabel("Resume workout")
                            }
                            .tint(theme.palette.accent)
                            .buttonStyle(.glassProminent)
                        } else {
                            Button("Pause workout", systemImage: "pause.fill") { send(.pauseTapped) }
                        }
                    }
                }
                if case .loaded = state.workout {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Workout options", systemImage: "ellipsis") { send(.workoutOptionsTapped) }
                    }
                }
            }
            .onChange(of: state.options, initial: true) { _, new in
                if let new { shown = new }
            }
            .koboActionSheet(
                isPresented: .action(state.options != nil) { if !$0 { send(.optionsDismissed) } },
                verbatim: title,
                message: nil
            ) {
                if case .workout(_, let hasNote) = shown {
                    if case .loaded(let workout) = state.workout, workout.exercises.count > 1 {
                        ActionSheetItem("Reorder exercises", systemImage: "arrow.up.arrow.down") {
                            send(.reorderTapped)
                        }
                    }
                    if hasNote {
                        ActionSheetItem("Edit note", systemImage: "square.and.pencil") { send(.sessionNoteTapped) }
                    } else {
                        ActionSheetItem("Add note", systemImage: "square.and.pencil") { send(.sessionNoteTapped) }
                    }
                    ActionSheetItem("Workout settings", systemImage: "gearshape") { send(.settingsTapped) }
                    ActionSheetItem("Save as template", systemImage: "square.and.arrow.down") {
                        send(.saveAsTemplateTapped)
                    }
                    ActionSheetItem("Discard workout", systemImage: "trash", role: .destructive) {
                        send(.discardTapped)
                    }
                } else if case .exercise(let exercise) = shown {
                    ActionSheetItem("Add set", systemImage: "plus") { send(.addSetTapped(exerciseID: exercise.id)) }
                    if exercise.hasNote {
                        ActionSheetItem("Edit note", systemImage: "square.and.pencil") {
                            send(.exerciseNoteTapped(exercise.id))
                        }
                    } else {
                        ActionSheetItem("Add note", systemImage: "square.and.pencil") {
                            send(.exerciseNoteTapped(exercise.id))
                        }
                    }
                    ActionSheetItem("Move up", systemImage: "arrow.up", isEnabled: exercise.canMoveUp) {
                        send(.exerciseMoveUpTapped(exercise.id))
                    }
                    ActionSheetItem("Move down", systemImage: "arrow.down", isEnabled: exercise.canMoveDown) {
                        send(.exerciseMoveDownTapped(exercise.id))
                    }
                    ActionSheetItem("Remove exercise", systemImage: "trash", role: .destructive) {
                        send(.exerciseRemoveTapped(exercise.id))
                    }
                }
            }
    }

    private var title: String {
        switch shown {
        case .workout(let title, _): title
        case .exercise(let exercise): exercise.name
        case nil: ""
        }
    }
}

/// An exercise's "…" at the end of its header: opens its options.
struct WorkoutExerciseOptionsButton: View {
    let exercise: WorkoutExercise
    let send: (WorkoutAction) -> Void

    var body: some View {
        IconButton(
            "ellipsis",
            verbatimAccessibilityLabel: String(localized: "Options for \(exercise.name)"),
            style: .plain
        ) { send(.exerciseOptionsTapped(exercise.id)) }
    }
}

/// Under the exercises: Add exercise, then Finish workout once started (unless the dock offers it), or View summary
/// once finished.
struct WorkoutFooterActions: View {
    let workout: WorkoutOverview
    let showsFinish: Bool
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(spacing: Space.sm) {
            Button("Add exercise", systemImage: "plus") { send(.addExerciseTapped) }
                .buttonStyle(.kobo(.secondary, width: .full))
            if workout.isFinished {
                Button("View summary", systemImage: "chart.bar") { send(.summaryTapped) }
                    .buttonStyle(.kobo(.secondary, width: .full))
            } else if showsFinish {
                Button("Finish workout", systemImage: "checkmark") { send(.finishTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            }
        }
        .padding(.top, Space.sm)
    }
}
