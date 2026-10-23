import KoboComponents
import KoboTokens
import SwiftUI

/// The workout's card, pinned to the bottom of the Workout screen the whole time it runs. It shows where the workout
/// stands and never edits a set: the clock and sets done, the exercise and set to do now with its dots and load, and
/// the one action that matters now on the right (Log set, Start, Resume, Finish workout), with the lesser one (Skip,
/// Finish) on the left. A rest, a rest that ran out and a pause each get a strip across the top, so they never read as
/// a set. The card runs full width and flush with the bottom of the screen. Before the start it is one big floating
/// Liquid Glass Start workout, low over the home indicator. It only draws; the ViewModel owns the clock and the rest.
struct WorkoutDock: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    /// The set to do now opens a new exercise: "Next exercise", with Start.
    var introducesExercise = false
    let send: (WorkoutAction) -> Void
    /// Scrolls the page to a set.
    let onFocus: (UUID) -> Void

    var body: some View {
        switch phase {
        case .start:
            // Prominent glass, tinted the accent: Apple's style for a floating primary action. The glass brings its
            // own depth and press response; it sits a little into the bottom safe area, close to the home indicator.
            Button { send(.startTapped) } label: {
                Label("Start workout", systemImage: "play.fill")
                    .font(theme.font(.headline))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Space.xs)
            }
            .buttonStyle(.glassProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(theme.palette.accent)
            .padding(.horizontal, Space.gutter)
            .padding(.bottom, -Space.md)
        case .lifting, .resting, .ready, .complete, .paused:
            if let content = phase.content {
                WorkoutDockCard(
                    phase: phase,
                    content: content,
                    introducesExercise: introducesExercise,
                    send: send,
                    onFocus: onFocus
                )
            }
        }
    }
}

private struct WorkoutDockCard: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState
    let introducesExercise: Bool
    let send: (WorkoutAction) -> Void
    let onFocus: (UUID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WorkoutDockBand(phase: phase)
            VStack(alignment: .leading, spacing: Space.sm) {
                if showsHeader { WorkoutDockHeader(content: content, phase: phase) }
                Button {
                    if let id = content.current?.id { onFocus(id) }
                } label: {
                    WorkoutDockNow(phase: phase, content: content, introducesExercise: introducesExercise)
                }
                .buttonStyle(.plain)
                .accessibilityHint(Text("Scrolls to the set"))
                if case .resting(_, let rest, _) = phase {
                    WorkoutDockRest(content: content, rest: rest, send: send)
                } else {
                    WorkoutDockButtons(
                        phase: phase,
                        content: content,
                        introducesExercise: introducesExercise,
                        send: send
                    )
                }
            }
            .padding(.horizontal, Space.cardInset)
            .padding(.vertical, Space.md)
        }
        .clipShape(WorkoutDockPanel.shape)  // the strip's corners
        .background { WorkoutDockPanel(isReady: isReady, isResting: isResting).ignoresSafeArea(edges: .bottom) }
    }

    /// The clock line, while lifting and once all is done; a strip takes its place otherwise.
    private var showsHeader: Bool {
        switch phase {
        case .lifting, .complete: true
        case .start, .resting, .ready, .paused: false
        }
    }

    private var isReady: Bool {
        if case .ready = phase { return true }
        return false
    }

    private var isResting: Bool {
        if case .resting = phase { return true }
        return false
    }
}

/// "⏱ 12:34" on the left, "Exercise 1 of 3 · 3/12 sets" on the right. The clock reads the time from the timeline each
/// second and works out the elapsed time from the start, so it never drifts.
private struct WorkoutDockHeader: View {
    @Environment(\.koboTheme) private var theme
    let content: WorkoutActivityAttributes.ContentState
    let phase: WorkoutDockPhase

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            if let since = phase.since {
                TimelineView(.periodic(from: since, by: 1)) { context in
                    let seconds = WorkoutClock.seconds(from: since, to: context.date)
                    Label {
                        Text(verbatim: seconds < WorkoutClock.limit ? WorkoutClock.text(seconds: seconds) : "–")
                            .contentTransition(.numericText())
                    } icon: {
                        Image(systemName: "timer").accessibilityHidden(true)
                    }
                    .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                    .foregroundStyle(theme.palette.accentText)
                    .accessibilityLabel(Text("Workout time"))
                    .accessibilityValue(Text(verbatim: WorkoutClock.spoken(seconds: seconds)))
                }
            }
            Spacer(minLength: Space.sm)
            Text(
                "Exercise \(content.exerciseNumber) of \(content.exerciseCount) · \(content.loggedSets)/\(content.totalSets) sets"
            )
            .font(theme.font(.footnote).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }
}

/// The exercise and set to do now ("Back squat", dots, "Set 2"), with "Next exercise" above it when it opens a new
/// one; on the right the load to lift, or a plain check once every set is done.
private struct WorkoutDockNow: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState
    let introducesExercise: Bool

    var body: some View {
        HStack(alignment: .center, spacing: Space.md) {
            if case .complete = phase {
                Image(systemName: "checkmark")
                    .font(theme.font(.title).weight(.bold))
                    .foregroundStyle(theme.palette.accentText)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: Space.xxs) {
                if introducesExercise {
                    Text("Next exercise")
                        .font(theme.font(.caption).weight(.bold))
                        .textCase(.uppercase)
                        .foregroundStyle(theme.palette.accentText)
                }
                Text(verbatim: content.current?.exerciseName ?? String(localized: "All sets done"))
                    .font(theme.font(.title2).weight(.bold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                HStack(spacing: Space.sm) {
                    WorkoutDockDots(dots: content.dots)
                    Text(verbatim: subtitle)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let set = content.current, !isResting {
                Text(verbatim: set.loadText)
                    .font(theme.font(.title).weight(.bold).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .contentShape(Rectangle())
    }

    private var isResting: Bool {
        if case .resting = phase { return true }
        return false
    }

    /// "Set 2"; "18 of 18 sets" once all is done.
    private var subtitle: String {
        guard let set = content.current else {
            return String(localized: "\(content.loggedSets) of \(content.totalSets) sets")
        }
        return set.title
    }
}

/// The action that matters now on the right, wide, with the lesser one on the left: Skip and Log set (or Start on a
/// new exercise), Finish and Resume, or Finish workout alone.
private struct WorkoutDockButtons: View {
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState
    let introducesExercise: Bool
    let send: (WorkoutAction) -> Void

    var body: some View {
        HStack(spacing: Space.sm) {
            switch phase {
            case .lifting, .ready:
                if let set = content.current {
                    Button("Skip") { send(.setSkipTapped(set.id)) }
                        .buttonStyle(.kobo(.tonal))
                        .accessibilityLabel(Text("Skip \(set.title)"))
                    if introducesExercise {
                        Button("Start") { send(.exerciseStartTapped(setID: set.id)) }
                            .buttonStyle(.kobo(.primary, width: .full))
                            .accessibilityLabel(Text("Start \(set.exerciseName)"))
                    } else {
                        Button("Log set", systemImage: "checkmark") { send(.setLogTapped(set.id)) }
                            .buttonStyle(.kobo(.primary, width: .full))
                            .accessibilityLabel(Text("Log \(set.exerciseName), \(set.title)"))
                    }
                }
            case .complete:
                Button("Finish workout") { send(.finishTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            case .paused:
                Button("Finish") { send(.finishTapped) }
                    .buttonStyle(.kobo(.secondary))
                    .accessibilityLabel(Text("Finish workout"))
                Button("Resume", systemImage: "play.fill") { send(.resumeTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            case .start, .resting:
                EmptyView()
            }
        }
    }
}
