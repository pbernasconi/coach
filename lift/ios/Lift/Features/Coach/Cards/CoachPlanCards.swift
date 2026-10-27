import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// A planned workout in a reply: its sport, title and time, the interval bars, the key targets and the first steps.
/// The header opens the full workout page.
struct CoachWorkoutCard: View {
    @Environment(\.koboTheme) private var theme
    let item: CoachItem
    let onOpen: () -> Void

    var body: some View {
        ChatEmbedCard(
            verbatim: item.title,
            subtitle: "\(item.stateLabel) · \(item.subtitle)",
            systemImage: (Sport(rawValue: item.sport) ?? .other).symbol,
            action: item.unplanned ? nil : onOpen
        ) {
            if !item.profile.isEmpty {
                ProfileStrip(segments: segments, height: Space.xxl, accessibilityLabel: "Intervals")
            }
            if !item.keyTargets.isEmpty {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    ForEach(Array(item.keyTargets.enumerated()), id: \.offset) { _, target in
                        Text(verbatim: target)
                            .font(theme.font(.subheadline).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                    }
                }
            }
            if !item.steps.isEmpty {
                VStack(alignment: .leading, spacing: Space.xs) {
                    ForEach(Array(item.steps.prefix(4).enumerated()), id: \.offset) { _, step in
                        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                            Text(verbatim: step.label)
                                .foregroundStyle(theme.palette.textSecondary)
                            Text(verbatim: step.detail).foregroundStyle(theme.palette.textPrimary)
                        }
                        .font(theme.font(.footnote))
                        .accessibilityElement(children: .combine)
                    }
                }
            } else if let notes = item.notes, !notes.isEmpty {
                Text(verbatim: notes)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .lineLimit(4)
            }
        }
    }

    /// "Z1"…"Z5" to the strip's levels 0…4, as the Week tab draws them.
    private var segments: [ProfileSegment] {
        item.profile.enumerated().map { index, bar in
            let level = Int(bar.zone.dropFirst()).map { $0 - 1 } ?? 0
            return ProfileSegment(id: index, width: bar.seconds, start: bar.from, end: bar.to, level: level)
        }
    }
}

/// A plan week in a reply: one column per day with a mark per session (done, missed, skipped, planned), then the
/// week's totals. The header opens the Week tab.
struct CoachWeekCard: View {
    @Environment(\.koboTheme) private var theme
    let week: CoachWeek
    let onOpen: () -> Void

    private static let dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        ChatEmbedCard(
            verbatim: week.title ?? String(localized: "This week"),
            subtitle: week.totals.text,
            systemImage: "calendar",
            action: onOpen
        ) {
            HStack(alignment: .top, spacing: Space.xs) {
                ForEach(Array(week.days.prefix(7).enumerated()), id: \.offset) { index, day in
                    VStack(spacing: Space.xs) {
                        Text(verbatim: String(localized: String.LocalizationValue(Self.dayNames[index])))
                            .font(theme.font(.caption).weight(.semibold))
                            .foregroundStyle(theme.palette.textSecondary)
                        ForEach(day.items.filter { $0.sport != "rest" }) { CoachWeekMark(item: $0) }
                        if day.items.allSatisfy({ $0.sport == "rest" }) {
                            Text(verbatim: "–").font(theme.font(.caption)).foregroundStyle(theme.palette.textTertiary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }
}

/// One session in the week card: its sport glyph on a fill for its state, never by colour alone (done has a check).
private struct CoachWeekMark: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var side = Size.iconLg + Space.xs
    let item: CoachItem

    var body: some View {
        Image(systemName: item.state == .done ? "checkmark" : (Sport(rawValue: item.sport) ?? .other).symbol)
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(ink)
            .frame(width: side, height: side)
            .background(fill, in: RoundedRectangle(cornerRadius: Radius.xs, style: .continuous))
            .opacity(item.state == .skipped ? 0.5 : 1)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(verbatim: "\(item.title), \(item.stateLabel)"))
    }

    private var ink: Color {
        switch item.state {
        case .done: theme.palette.success.ink
        case .missed: theme.palette.danger.ink
        case .today: theme.palette.accentText
        case .planned, .skipped: theme.palette.textSecondary
        }
    }

    private var fill: Color {
        switch item.state {
        case .done: theme.palette.success.soft
        case .missed: theme.palette.danger.soft
        case .today: theme.palette.accentSoft
        case .planned, .skipped: theme.palette.surfaceSunken
        }
    }
}

/// A day of the calendar in a reply: busy, free and planned blocks (Kobo `DayTimeline`).
struct CoachDayCard: View {
    let day: CoachDayData

    var body: some View {
        ChatEmbedCard(
            verbatim: day.title,
            subtitle: (day.allDay ?? []).isEmpty ? nil : (day.allDay ?? []).joined(separator: " · "),
            systemImage: "clock"
        ) {
            DayTimeline(
                day.blocks.enumerated().map { index, block in
                    DayTimelineBlock(
                        id: "\(index)",
                        start: block.start,
                        end: block.end,
                        kind: block.kind == "free" ? .free : block.kind == "session" ? .highlight : .busy,
                        title: block.title
                    )
                }
            )
        }
    }
}
