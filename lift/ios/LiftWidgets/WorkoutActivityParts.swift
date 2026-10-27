import AppIntents
import SwiftUI
import UIKit

extension WorkoutActivityAttributes.ContentState {
    /// A rest is counting down: there is one and its end has not passed (`isStale` is the context's).
    func isResting(isStale: Bool) -> Bool {
        rest != nil && !isStale
    }
}

/// The current exercise's sets as dots: orange when logged, an orange ring on the set to do now, faint when skipped or
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

/// "0:36": the time rested so far, counting up to the rest's length. The system updates it; the app sends no ticks.
struct RestElapsed: View {
    let rest: RestSnapshot

    var body: some View {
        Text(timerInterval: rest.interval, countsDown: false)
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

/// The header of a rest: an orange "RESTING" chip, then the sets done, or "Next exercise" when the rest follows an
/// exercise's last set. A chip, not a strip across the top edge: the
/// Lock Screen draws a dark rim round the banner that shows as a line over a bright strip.
struct RestBand: View {
    @Environment(\.colorScheme) private var colorScheme
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 7) {
            Label("Resting", systemImage: "timer")
                .font(.caption.weight(.heavy))
                .textCase(.uppercase)
                .foregroundStyle(WidgetColors.ink)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(WidgetColors.accent, in: Capsule())
            Spacer(minLength: 8)
            // After an exercise's last set the rest leads into a new one; say so, so the next exercise below reads as
            // a preview, not the lift under way.
            if state.opensExercise {
                Text("Next exercise")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(WidgetColors.accentText(for: colorScheme))
                    .lineLimit(1)
            } else {
                Text("\(state.loggedSets)/\(state.totalSets) sets")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }
}

/// The exercise's photo in a white circle; nothing when the content carries none.
struct ExerciseStill: View {
    @Environment(\.colorScheme) private var colorScheme
    let set: WorkoutActivitySet
    let size: CGFloat

    var body: some View {
        if let data = set.still, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .background(WidgetColors.stillBackground)
                .clipShape(Circle())
                .opacity(colorScheme == .dark ? 0.85 : 1)
                .accessibilityHidden(true)
        }
    }
}

/// The bottom bar while lifting: "100 kg × 5 reps" and a check that logs it (Done).
struct LiftBar: View {
    let set: WorkoutActivitySet

    var body: some View {
        HStack(spacing: 8) {
            Text(verbatim: set.loadLine)
                .font(.system(.title2, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(intent: LogSetIntent()) {
                Image(systemName: "checkmark")
                    .font(.title3.weight(.bold))
                    .frame(width: 40, height: 40)
                    .foregroundStyle(WidgetColors.ink)
                    .background(WidgetColors.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Log \(set.exerciseName), \(set.title)"))
        }
    }
}

/// The bottom bar while resting: the time rested, large, against the rest's length ("0:36 / 2:00"), then Skip.
struct RestBar: View {
    @Environment(\.colorScheme) private var colorScheme
    let rest: RestSnapshot
    let timerSize: CGFloat

    private var elapsed: Text {
        Text(timerInterval: rest.interval, countsDown: false)
            .font(.system(size: timerSize, weight: .bold, design: .rounded))
            .foregroundStyle(WidgetColors.accentText(for: colorScheme))
    }

    private var limit: Text {
        Text(verbatim: "/ \(rest.limitText)")
            .font(.system(.title3, design: .rounded).weight(.semibold))
            .foregroundStyle(.secondary)
    }

    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            // One Text, so "/ 2:00" sits right after the time: a timer Text alone takes the width of its longest value.
            Text("\(elapsed) \(limit)")
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(intent: SkipRestIntent()) {
                Text("Skip")
                    .font(.headline)
                    .padding(.horizontal, 10)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.regular)
            .tint(WidgetColors.accent)
            .foregroundStyle(WidgetColors.ink)
            .accessibilityLabel(Text("Skip rest"))
        }
        .accessibilityElement(children: .contain)
    }
}
