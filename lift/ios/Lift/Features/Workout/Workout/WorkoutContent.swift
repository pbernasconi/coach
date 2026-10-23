import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the session header, one section per exercise, the dock pinned at the bottom (Start, then the clock, the set
/// to do now and the rest) and the set editor (SCR-2). Ticking a set brings that set into view, clear of the dock, and
/// tapping the dock's set goes back to it. When the rest runs out the dock turns to the next set and brings it into
/// view. Haptics: a tap for each of the last three seconds, then a success, unless Workout settings turned rest alerts off.
struct WorkoutContent: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let state: WorkoutState
    let send: (WorkoutAction) -> Void

    /// Where a focused set lands: the upper part of the screen, so the rest bar never covers it.
    private static let focusAnchor = UnitPoint(x: 0.5, y: 0.35)

    var body: some View {
        ScrollViewReader { proxy in
            page(proxy)
                .onChange(of: state.rest?.run) { _, run in
                    if run != nil { focus(state.rest?.setID, proxy) }
                }
                .onChange(of: ready?.setID) { _, setID in focus(setID, proxy) }
                .koboFeedback(trigger: state.rest?.remaining) { _, left in
                    state.playsRestHaptics && (1...RestCue.countdownTaps).contains(left ?? 0) ? .tap : nil
                }
                .koboFeedback(trigger: ready?.since) { _, since in
                    state.playsRestHaptics && since != nil ? .success : nil
                }
        }
    }

    private func page(_ proxy: ScrollViewProxy) -> some View {
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
                WorkoutBody(
                    workout: workout,
                    thumbnails: state.thumbnails,
                    rest: state.setRowRest,
                    dockFinishes: state.dockFinishes,
                    send: send
                )
            }
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .workoutOptions(state: state, send: send)
        // Glass style: no bar material behind it. The dock brings its own opaque panel.
        .pinnedFooter(style: .glass, isPresented: state.dock != nil) {
            if let dock = state.dock {
                WorkoutDock(phase: dock, introducesExercise: state.dockIntroducesExercise, send: send) {
                    focus($0, proxy)
                }
                // A sheet, not the system dialog: on iOS 26 the dialog is a popover that leaves out "Keep going".
                .koboConfirm(
                    isPresented: .action(state.isConfirmingFinish) { if !$0 { send(.finishCancelled) } },
                    ConfirmationAction(
                        title: "Finish workout?",
                        message: "^[\(state.plannedSetsLeft) set](inflect: true) not logged yet. You can still log them after you finish.",
                        confirmLabel: "Finish workout",
                        cancelLabel: "Keep going"
                    ) { send(.finishConfirmed) },
                    style: .sheet
                )
            }
        }
        .modifier(WorkoutEditorSheets(state: state, send: send))
        .workoutMenuSheets(state: state, send: send)
    }

    /// The "rest over" state, while its set is still planned (not logged, skipped or removed some other way).
    private var ready: RestReady? {
        guard let ready = state.ready, case .loaded(let workout) = state.workout, workout.isPlanned(ready.setID)
        else { return nil }
        return ready
    }

    /// Scrolls a set into the upper part of the page.
    private func focus(_ setID: UUID?, _ proxy: ScrollViewProxy) {
        guard let setID else { return }
        withKoboAnimation(.navigate, reduceMotion: reduceMotion) { proxy.scrollTo(setID, anchor: Self.focusAnchor) }
    }

    /// The session title in the inline navigation bar, which keeps the page compact.
    private var title: String {
        guard case .loaded(let workout) = state.workout else { return "" }
        return workout.title
    }
}

/// The rest bar's haptic countdown (a count, not a duration constant elsewhere).
private enum RestCue {
    static let countdownTaps = 3
}

/// The set editor and the note editor sheets; Done saves, it never logs a set.
private struct WorkoutEditorSheets: ViewModifier {
    let state: WorkoutState
    let send: (WorkoutAction) -> Void

    func body(content: Content) -> some View {
        content
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
            .koboSheet(
                item: Binding<NoteEditor?>.action(state.noteEditor) { if $0 == nil { send(.noteDismissed) } },
                title: \.title,
                hasChanges: state.noteEditor?.hasChanges ?? false
            ) { editor in
                NoteEditorField(editor: editor, send: send)
            } footer: { _ in
                Button("Done") { send(.noteDoneTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            }
    }
}

/// The loaded session: the day and progress on one compact line, then the exercises in order.
private struct WorkoutBody: View {
    @Environment(\.koboTheme) private var theme
    let workout: WorkoutOverview
    let thumbnails: [String: MediaImage]
    /// The running rest and the set it comes before.
    let rest: SetRowRest?
    /// The dock offers Finish (every set done, or paused), so the list does not repeat it.
    let dockFinishes: Bool
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
                WorkoutSessionNotes(note: workout.note, warmUpNote: workout.warmUpNote) { send(.sessionNoteTapped) }
            }
            ForEach(workout.exercises) { exercise in
                WorkoutExerciseSection(
                    exercise: exercise,
                    thumbnail: exercise.catalogID.map { thumbnails[$0] ?? .loading },
                    rest: rest,
                    send: send
                )
            }
            WorkoutFooterActions(workout: workout, showsFinish: !dockFinishes, send: send)
        }
        .pageColumn()
        .padding(.top, Space.sm)
        .padding(.bottom, Space.xxl)
    }

    private var dayText: some View {
        Text(verbatim: workout.dayLine)
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(theme.palette.accentText)
    }

    private var setsText: some View {
        Text(verbatim: SessionText.sets(logged: workout.loggedSets, total: workout.totalSets))
            .font(theme.font(.subheadline).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
    }
}

/// Last time's values, the weight and reps steppers, "Apply to later sets", the RPE chips, the note and Remove set in the
/// editor sheet. Done (in the sheet footer) saves; it never logs the set.
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
        if let loading = editor.loading {
            BarPlates(loading: loading, unit: editor.unit)
        }
        StepperField("Reps", value: .action(editor.reps) { send(.editorRepsChanged($0)) }, in: 0...100)
        if editor.laterSets > 0 {
            ToggleRow(
                "Apply to later sets",
                subtitle: "New weight on the next ^[\(editor.laterSets) planned set](inflect: true)",
                systemImage: "arrow.down.to.line",
                isOn: .action(editor.appliesToLater) { send(.editorApplyToLaterChanged($0)) }
            )
        }
        SetEditorRPE(rpe: editor.rpe, send: send)
        KoboTextArea(
            "Note",
            text: .action(editor.note) { send(.editorNoteChanged($0)) },
            prompt: "Optional",
            lines: 1...4
        )
        // Removes at once and closes the sheet; the "Set removed" toast offers Undo (product rule).
        Button("Remove set", systemImage: "trash", role: .destructive) { send(.setRemoveTapped(editor.id)) }
            .buttonStyle(.kobo(.destructive, size: .compact, width: .full))
            .accessibilityLabel(Text("Remove \(editor.title)"))
    }
}
