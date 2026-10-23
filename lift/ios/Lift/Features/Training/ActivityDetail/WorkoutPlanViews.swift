import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// A workout still to do: its plan, as the web's workout window shows it. The header with its status, the numbers, the
/// workout (main work, interval chart, steps), the time in each zone, the coach's notes, "How did it feel" from the
/// workout's day on, and the Lift session when Lift has it.
struct WorkoutPlanSections: View {
    @Environment(\.koboTheme) private var theme
    let workout: AppPlannedWorkout
    /// "How did it feel", under the numbers once the workout is done; nil hides it.
    let feedback: WorkoutFeedback?
    let save: WorkoutFeedbackSaveState
    /// "Start workout" and "Mark done".
    var write = PlanWrite.idle
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            PlannedWorkoutHeader(workout: workout)
            WorkoutPlanActions(workout: workout, write: write, send: send)
            if !workout.hero.isEmpty {
                WorkoutStatGrid(items: workout.hero, id: \.label) { stat in
                    WorkoutStatCell(label: stat.label, value: stat.valueText, unit: stat.unit)
                }
                .koboCard()
            }
            if let feedback, workout.state != "planned" {
                WorkoutFeedbackCard(feedback: feedback, save: save) { send(.feedback($0)) }
            }
            WorkoutPlanCards(workout: workout)
            links
        }
    }

    @ViewBuilder private var links: some View {
        if let session = workout.liftSessionId {
            ListSection {
                ListRow("Open session", action: { send(.liftSessionTapped(session)) })
            }
        }
    }
}

/// The plan's own cards: the workout structure and its time in zones, the intensity, the coach's notes. On a done
/// workout they sit at the foot of what was done (with no planned zones: the activity has its real ones), so planned
/// and done read as one page.
struct WorkoutPlanCards: View {
    @Environment(\.koboTheme) private var theme
    let workout: AppPlannedWorkout
    /// Done: the activity shows its own time in zones.
    var isDone = false

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let structure = workout.workout {
                PlannedStructureCard(structure: structure)
                if let zones = structure.zones, !isDone {
                    CardSection(verbatim: String(localized: "Time in zones")) {
                        ZoneBars(items: zones.items.map { item in
                            ZoneBarItem(
                                name: [item.zone, item.name].compactMap(\.self).joined(separator: " "),
                                detail: item.rangeText,
                                amount: item.seconds,
                                amountText: item.timeText,
                                color: PlannedZone.color(item.zone, palette: theme.palette),
                                percent: item.percent
                            )
                        })
                    }
                }
            }
            if let exercises = workout.exercises, !exercises.isEmpty {
                PlannedExercisesCard(exercises: exercises)
            } else if let intensity = workout.intensity, workout.workout == nil {
                textCard("Intensity", intensity)
            }
            if let notes = workout.notes {
                textCard("Coach notes", notes)
            }
        }
    }

    private func textCard(_ title: LocalizedStringKey, _ text: String) -> some View {
        CardSection(title) {
            Text(verbatim: text)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// The shared workout header: the sport and when, the title, the status, and "Changed for how you feel" when the
/// coach adapted it.
struct PlannedWorkoutHeader: View {
    @Environment(\.koboTheme) private var theme
    let workout: AppPlannedWorkout

    var body: some View {
        WorkoutHeader(
            sport: Sport(rawValue: workout.sport) ?? .other,
            kicker: workout.subtitle,
            title: workout.title,
            status: WorkoutStatus(planState: workout.state, compliance: workout.compliance),
            statusLabel: workout.stateLabel
        ) {
            if workout.adapted {
                Text("Changed for how you feel")
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.warning.ink)
            }
        }
    }
}

/// The workout card: the main work, the interval chart in zone colours with its time labels, then every step. A tap
/// or a drag on the chart picks a bar, and a tap on a step picks its first bar: the picked step's detail shows under
/// the chart (as the web chart's tooltip), its row lights up, and the other bars dim.
private struct PlannedStructureCard: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let structure: PlannedStructure
    @State private var picked: Int?

    var body: some View {
        CardSection("Workout") {
            ForEach(Array(structure.keyTargets.enumerated()), id: \.offset) { _, line in
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Capsule()
                        .fill(PlannedZone.color(line.zone, palette: theme.palette))
                        .frame(width: Space.xs + Space.xxs, height: Space.md)
                    Text(verbatim: line.text)
                        .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                }
            }
            VStack(spacing: Space.xxs) {
                ProfileStrip(segments: segments, height: Space.xxxl * 3, accessibilityLabel: "Interval chart")
                    .selectable($picked, highlighted: [])
                PlannedTicks(ticks: structure.ticks)
            }
            if let bar = pickedBar {
                PlannedBarDetail(bar: bar) { picked = nil }
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            }
            PlannedStepList(steps: structure.steps, pickedStep: pickedBar?.stepId) { stepId in
                let first = structure.profile.firstIndex { $0.stepId == stepId }
                picked = first == picked ? nil : first
            }
        }
        .koboAnimation(.fastEffects, value: picked)
    }

    private var pickedBar: PlannedBar? {
        guard let picked, structure.profile.indices.contains(picked) else { return nil }
        return structure.profile[picked]
    }

    private var segments: [ProfileSegment] {
        structure.profile.enumerated().map { index, bar in
            ProfileSegment(
                id: index,
                width: bar.seconds,
                start: bar.from,
                end: bar.to,
                level: PlannedZone.level(bar.zone)
            )
        }
    }
}

/// What the picked bar is: its kind and repeat with its zone, its length, target and % of the anchor, when it runs,
/// and the coach's words for it.
private struct PlannedBarDetail: View {
    @Environment(\.koboTheme) private var theme
    let bar: PlannedBar
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            HStack(spacing: Space.xs) {
                RoundedRectangle(cornerRadius: Size.hairline * 2)
                    .fill(PlannedZone.color(bar.zone, palette: theme.palette))
                    .frame(width: Space.sm, height: Space.sm)
                Text(verbatim: bar.title ?? bar.zone)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                Text(verbatim: bar.zone)
                    .font(theme.font(.caption).weight(.semibold))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            Text(verbatim: [bar.lengthText, bar.targetText, bar.percentText].compactMap(\.self).joined(separator: " · "))
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textPrimary)
            if let time = bar.timeText {
                Text(verbatim: time)
                    .font(theme.font(.caption).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if let cue = bar.cue {
                Text(verbatim: cue)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.palette.surfaceSunken, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: Text("Close")) { onClose() }
    }
}

/// The time labels under the chart, each at its place along it.
private struct PlannedTicks: View {
    @Environment(\.koboTheme) private var theme
    let ticks: [PlannedTick]

    var body: some View {
        GeometryReader { proxy in
            ForEach(Array(ticks.enumerated()), id: \.offset) { _, tick in
                Text(verbatim: tick.text)
                    .font(theme.font(.caption).monospacedDigit())
                    .foregroundStyle(theme.palette.textTertiary)
                    .fixedSize()
                    .position(x: x(of: tick, width: proxy.size.width), y: proxy.size.height / 2)
            }
        }
        .frame(height: Space.lg)
        .accessibilityHidden(true)
    }

    /// Each label centres on its time, kept a little in from both edges.
    private func x(of tick: PlannedTick, width: CGFloat) -> CGFloat {
        let inset = Space.md
        return min(max(tick.at * width, inset), width - inset)
    }
}
