import AppIntents
import SwiftUI

extension WorkoutActivityAttributes.ContentState {
    /// A rest is counting down: there is one and its end has not passed (`isStale` is the context's).
    func isResting(isStale: Bool) -> Bool {
        rest != nil && !isStale
    }
}

/// The current exercise's sets as dots: amber when logged, an amber ring on the set to do now, faint when skipped or
/// still planned. Like the set rows in the app, read left to right.
struct SetDots: View {
    let dots: [WorkoutActivityDot]
    var size: CGFloat = 7

    var body: some View {
        HStack(spacing: size * 0.6) {
            ForEach(Array(dots.prefix(12).enumerated()), id: \.offset) { _, dot in
                SetDot(dot: dot, size: size)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(dots.count(where: { $0 == .done })) of \(dots.count) sets logged"))
    }
}

private struct SetDot: View {
    let dot: WorkoutActivityDot
    let size: CGFloat

    var body: some View {
        switch dot {
        case .done:
            Circle().fill(WidgetColors.accent).frame(width: size, height: size)
        case .current:
            Circle()
                .strokeBorder(WidgetColors.accent, lineWidth: max(1.5, size * 0.24))
                .frame(width: size * 1.35, height: size * 1.35)
        case .skipped:
            Circle().fill(.secondary.opacity(0.45)).frame(width: size, height: size)
        case .planned:
            Circle().strokeBorder(.secondary.opacity(0.6), lineWidth: 1).frame(width: size, height: size)
        }
    }
}

/// "100 kg × 5", "× 12" without a weight, "100 kg" without reps.
struct LoadText: View {
    let set: WorkoutActivitySet

    var body: some View {
        switch (set.weight, set.reps) {
        case (let weight?, let reps?): Text(verbatim: "\(weight) \(set.unit) × \(reps)")
        case (let weight?, nil): Text(verbatim: "\(weight) \(set.unit)")
        case (nil, let reps?): Text("\(reps) reps")
        case (nil, nil): Text(verbatim: set.title)
        }
    }
}

/// "1:30", counting down to the end of the rest. The system updates it; the app sends no ticks.
struct RestCountdown: View {
    let rest: RestSnapshot

    var body: some View {
        Text(timerInterval: rest.interval, countsDown: true)
            .monospacedDigit()
    }
}

/// "+0:12": time since the rest ended, counting up, once the content is stale.
struct RestOvertime: View {
    let rest: RestSnapshot

    var body: some View {
        Text("+\(Text(rest.endsAt, style: .timer))")
            .monospacedDigit()
    }
}

/// The rest filling up, like the in-app rest bar; the whole workout's progress when there is no rest.
struct WorkoutBar: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let rest = state.rest {
                ProgressView(timerInterval: rest.interval, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .accessibilityLabel(Text("Rest"))
            } else {
                ProgressView(value: state.progress)
                    .accessibilityLabel(Text("\(state.loggedSets) of \(state.totalSets) sets done"))
            }
        }
        .progressViewStyle(.linear)
        .tint(WidgetColors.accent)
    }
}

/// The buttons under the set: Done (log it), and Next or, while resting, +30s and Skip. Each runs an App Intent in the
/// background (`WorkoutActivityIntents.swift`), so they work from the Lock Screen and the Dynamic Island without
/// unlocking or opening Lift.
struct WorkoutButtons: View {
    @Environment(\.colorScheme) private var colorScheme
    let set: WorkoutActivitySet
    let isResting: Bool

    var body: some View {
        HStack(spacing: 8) {
            if isResting {
                Button(intent: AddRestTimeIntent()) { Text("+30s") }
                    .accessibilityLabel(Text("Add 30 seconds"))
                Button(intent: SkipRestIntent()) { Text("Skip") }
                    .accessibilityLabel(Text("Skip rest"))
            } else {
                Button(intent: ShowNextSetIntent()) {
                    Label("Next", systemImage: "forward.end.fill")
                }
                .accessibilityLabel(Text("Show the next set"))
            }
            Spacer(minLength: 0)
            Button(intent: LogSetIntent()) {
                Label("Done", systemImage: "checkmark")
                    .padding(.horizontal, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(WidgetColors.accent)
            .foregroundStyle(WidgetColors.ink)
            .accessibilityLabel(Text("Log \(set.exerciseName), \(set.title)"))
        }
        .font(.subheadline.weight(.semibold))
        .labelStyle(.titleAndIcon)
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(.small)
        .tint(WidgetColors.accentText(for: colorScheme))
    }
}
