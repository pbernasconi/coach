import KoboComponents
import KoboTokens
import SwiftUI

/// The workout's card, pinned to the bottom of the Workout screen the whole time it runs, laid out like the Lock
/// Screen's Live Activity: the clock and where the workout stands, the exercise and set to do now with its dots, the
/// load or the rest countdown, a bar, then the one action that matters now (Log set, +30s and Skip, or Finish). Before
/// the start it is one big Start workout. It only draws; the ViewModel owns the clock and the rest.
struct WorkoutDock: View {
    let phase: WorkoutDockPhase
    let send: (WorkoutAction) -> Void
    /// Scrolls the page to a set.
    let onFocus: (UUID) -> Void

    var body: some View {
        switch phase {
        case .start:
            Button("Start workout", systemImage: "play.fill") { send(.startTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
                .padding(.bottom, Space.xs)
        case .lifting, .resting, .ready, .complete:
            if let content = phase.content, let since = phase.since {
                WorkoutDockCard(phase: phase, content: content, since: since, send: send, onFocus: onFocus)
            }
        }
    }
}

private struct WorkoutDockCard: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState
    let since: Date
    let send: (WorkoutAction) -> Void
    let onFocus: (UUID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            WorkoutDockHeader(content: content, since: since)
            Button {
                if let id = content.current?.id { onFocus(id) }
            } label: {
                WorkoutDockNow(phase: phase, content: content)
            }
            .buttonStyle(.plain)
            .accessibilityHint(Text("Scrolls to the set"))
            bar
            WorkoutDockButtons(phase: phase, content: content, send: send)
        }
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.md)
        .background { WorkoutDockPanel(isReady: isReady) }
    }

    private var isReady: Bool {
        if case .ready = phase { return true }
        return false
    }

    /// The rest filling up while resting, else the sets logged.
    @ViewBuilder private var bar: some View {
        if case .resting(_, let rest, _) = phase {
            InlineProgress(value: Double(rest.elapsed), total: Double(rest.total), accessibilityLabel: "Rest")
        } else {
            InlineProgress(value: content.progress, accessibilityLabel: "Sets logged")
        }
    }
}

/// "⏱ 12:34" on the left, "Exercise 1 of 3 · 3/12 sets" on the right. The clock reads the time from the timeline each
/// second and works out the elapsed time from the start, so it never drifts.
private struct WorkoutDockHeader: View {
    @Environment(\.koboTheme) private var theme
    let content: WorkoutActivityAttributes.ContentState
    let since: Date

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
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
            Spacer(minLength: Space.sm)
            Text("Exercise \(content.exerciseNumber) of \(content.exerciseCount) · \(content.loggedSets)/\(content.totalSets) sets")
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

/// The exercise and set to do now ("Back squat", dots, "Set 2"), and on the right the big number: the rest counting
/// down, or the load to lift ("Rest over +0:12" above it once the rest ended).
private struct WorkoutDockNow: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
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
            trailing
        }
        .contentShape(Rectangle())
    }

    /// "Set 2", with the load while the big number is the rest; the next exercise once all is done.
    private var subtitle: String {
        guard let set = content.current else {
            return String(localized: "\(content.loggedSets) of \(content.totalSets) sets")
        }
        if case .resting = phase { return "\(set.title) · \(set.loadText)" }
        return set.title
    }

    @ViewBuilder private var trailing: some View {
        switch phase {
        case .resting(_, let rest, _):
            VStack(alignment: .trailing, spacing: 0) {
                Text("Rest")
                    .font(theme.font(.caption).weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: rest.clockText)
                    .font(theme.font(.largeTitle).weight(.semibold).monospacedDigit())
                    .foregroundStyle(rest.remaining <= 10 ? theme.palette.accentText : theme.palette.textPrimary)
                    .contentTransition(.numericText(value: Double(rest.remaining)))
                    .koboAnimation(.state, value: rest.remaining)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("\(rest.remaining) of \(rest.total) seconds of rest left"))
            .accessibilityAddTraits(.updatesFrequently)
        case .lifting, .ready:
            if let set = content.current {
                VStack(alignment: .trailing, spacing: 0) {
                    if case .ready(_, let ready, _) = phase {
                        Text("Rest over +\(ready.since, style: .timer)")
                            .font(theme.font(.caption).weight(.bold))
                            .textCase(.uppercase)
                            .monospacedDigit()
                            .foregroundStyle(theme.palette.accentText)
                    }
                    Text(verbatim: set.loadText)
                        .font(theme.font(.title).weight(.bold).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
        case .complete:
            Image(systemName: "checkmark.circle.fill")
                .font(theme.font(.largeTitle))
                .foregroundStyle(theme.palette.success.ink)
                .accessibilityHidden(true)
        case .start:
            EmptyView()
        }
    }
}

/// The action that matters now: Log set (and Skip), +30s and Skip rest, or Finish workout.
private struct WorkoutDockButtons: View {
    let phase: WorkoutDockPhase
    let content: WorkoutActivityAttributes.ContentState
    let send: (WorkoutAction) -> Void

    var body: some View {
        HStack(spacing: Space.sm) {
            switch phase {
            case .resting:
                Button("+30s") { send(.restExtendTapped) }
                    .buttonStyle(.kobo(.secondary, width: .full))
                    .accessibilityLabel(Text("Add 30 seconds"))
                Button("Skip rest") { send(.restSkipTapped) }
                    .buttonStyle(.kobo(.tonal, width: .full))
            case .lifting, .ready:
                if let set = content.current {
                    Button("Log set", systemImage: "checkmark") { send(.setLogTapped(set.id)) }
                        .buttonStyle(.kobo(.primary, width: .full))
                        .accessibilityLabel(Text("Log \(set.exerciseName), \(set.title)"))
                    Button("Skip") { send(.setSkipTapped(set.id)) }
                        .buttonStyle(.kobo(.tonal))
                        .accessibilityLabel(Text("Skip \(set.title)"))
                }
            case .complete:
                Button("Finish workout", systemImage: "flag.checkered") { send(.finishTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            case .start:
                EmptyView()
            }
        }
    }
}
