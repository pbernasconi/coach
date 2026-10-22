import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: one planned workout as the web's workout window shows it (SCR-2). The header with its status, the
/// numbers, the workout (main work, interval chart, steps), the time in each zone, the coach's notes, and links to the
/// activity or Lift session that completed it.
struct PlannedWorkoutContent: View {
    let state: PlannedWorkoutState
    let send: (PlannedWorkoutAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.workout,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { workout in
                PlannedWorkoutSections(workout: workout, send: send)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: state.workout.content.value?.title ?? String(localized: "Workout")))
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct PlannedWorkoutSections: View {
    @Environment(\.koboTheme) private var theme
    let workout: AppPlannedWorkout
    let send: (PlannedWorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            PlannedWorkoutHeader(workout: workout)
            if !workout.hero.isEmpty {
                TileGrid(workout.hero, id: \.label) { stat in
                    StatTile(verbatim: stat.label, value: stat.valueText, unit: stat.unit)
                }
            }
            if let structure = workout.workout {
                PlannedStructureCard(structure: structure)
                if let zones = structure.zones {
                    CardSection(verbatim: String(localized: "Time in zones · \(zones.basis)")) {
                        ZoneBars(items: zones.items.map { item in
                            ZoneBarItem(
                                name: item.zone,
                                amount: item.seconds,
                                amountText: item.timeText,
                                color: PlannedZone.color(item.zone, palette: theme.palette),
                                percent: item.percent
                            )
                        })
                    }
                }
            }
            if let intensity = workout.intensity, workout.workout == nil {
                textCard("Intensity", intensity)
            }
            if let notes = workout.notes {
                textCard("Coach notes", notes)
            }
            links
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

    @ViewBuilder private var links: some View {
        let activity = workout.done?.activityId
        if activity != nil || workout.liftSessionId != nil {
            ListSection {
                if let activity {
                    ListRow(
                        verbatim: String(localized: "Open activity"),
                        subtitle: workout.done?.name,
                        action: { send(.activityTapped(activity)) }
                    )
                }
                if let session = workout.liftSessionId {
                    ListRow("Open session", action: { send(.sessionTapped(session)) })
                }
            }
        }
    }
}

/// The shared workout header: the sport and when, the title, the status, and "Changed for how you feel" when the
/// coach adapted it.
private struct PlannedWorkoutHeader: View {
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

/// The workout card: the main work, the interval chart in zone colours with its time labels, then every step.
private struct PlannedStructureCard: View {
    @Environment(\.koboTheme) private var theme
    let structure: PlannedStructure

    var body: some View {
        CardSection(verbatim: String(localized: "Workout · \(structure.summaryText)")) {
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
                PlannedTicks(ticks: structure.ticks)
            }
            PlannedStepList(steps: structure.steps)
        }
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
