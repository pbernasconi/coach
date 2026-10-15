import AppIntents
import SwiftUI

/// "1:30", counting down to the end of the rest. The system updates it; the app sends no ticks.
struct RestCountdownText: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        Text(timerInterval: state.interval, countsDown: true)
            .monospacedDigit()
    }
}

/// The rest filling up, like the in-app rest bar.
struct RestProgressBar: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        ProgressView(timerInterval: state.interval, countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(WidgetColors.accent)
        .accessibilityLabel(Text("Rest"))
    }
}

/// The timer symbol for the compact and minimal Dynamic Island.
struct RestTimerIcon: View {
    var body: some View {
        Image(systemName: "timer")
            .foregroundStyle(WidgetColors.accent)
            .accessibilityLabel(Text("Rest"))
    }
}

/// "Next: Set 3 · 5 @ 100 kg", or nothing after the last planned set.
struct RestNextSetText: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        if let next = state.nextSetLabel {
            Text("Next: \(next)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

/// +30s and Skip. Each is an App Intent the system runs in the background (`AddRestTimeIntent`, `SkipRestIntent`), so
/// they work from the Lock Screen and the Dynamic Island without opening Lift, and the in-app rest bar follows them.
struct RestActivityButtons: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 8) {
            Button(intent: AddRestTimeIntent()) {
                Text("+30s")
            }
            .accessibilityLabel(Text("Add 30 seconds"))
            Button(intent: SkipRestIntent()) {
                Text("Skip")
            }
            .accessibilityLabel(Text("Skip rest"))
        }
        .font(.subheadline.weight(.semibold))
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(.small)
        .tint(WidgetColors.accentText(for: colorScheme))
        .fixedSize()
    }
}

/// The next set beside the buttons, or the buttons alone after the last planned set.
struct RestNextSetRow: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            RestNextSetText(state: state)
                .frame(maxWidth: .infinity, alignment: .leading)
            RestActivityButtons()
        }
    }
}

/// The Lock Screen banner: exercise and set, a big countdown, the bar, then the next set beside +30s and Skip.
struct RestLockScreenView: View {
    @Environment(\.colorScheme) private var colorScheme
    let attributes: RestActivityAttributes
    let state: RestActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: attributes.exerciseName)
                        .font(.headline)
                        .lineLimit(1)
                    Text("Rest after \(attributes.setLabel)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                RestCountdownText(state: state)
                    .font(.largeTitle.weight(.semibold))
                    .foregroundStyle(WidgetColors.accentText(for: colorScheme))
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 120, alignment: .trailing)
            }
            RestProgressBar(state: state)
            RestNextSetRow(state: state)
        }
        .padding(16)
    }
}

/// The expanded Dynamic Island's leading region: exercise and set.
struct RestExpandedLeading: View {
    let attributes: RestActivityAttributes

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: attributes.exerciseName)
                .font(.headline)
                .lineLimit(1)
            Text(verbatim: attributes.setLabel)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.leading, 4)
    }
}

/// The expanded Dynamic Island's bottom region: the bar, then the next set beside +30s and Skip.
struct RestExpandedBottom: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            RestProgressBar(state: state)
            RestNextSetRow(state: state)
        }
        .padding(.horizontal, 4)
    }
}
