import KoboComponents
import KoboTokens
import SwiftUI

/// This week in one line ("1 of 2 sessions this week") with a thin bar, then the next session as one row.
struct LiftWeekLine: View {
    @Environment(\.koboTheme) private var theme
    let summary: LiftSummary
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(verbatim: summary.text)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                InlineProgress(value: summary.progress, accessibilityLabel: "Sessions this week")
            }
            if let next = summary.next {
                ListRow(verbatim: next.title, subtitle: next.detail, value: next.whenText, action: {
                    send(.sessionTapped(next.sessionId))
                }) {
                    Image(systemName: "figure.strengthtraining.traditional")
                        .foregroundStyle(theme.palette.accentText)
                        .accessibilityHidden(true)
                }
                .koboCard(padding: 0)
            } else {
                Text(verbatim: summary.nextEmptyText)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}

/// The focus muscles: for each, the sets done (solid) and still planned (faded) this week on one bar with the 10–20
/// band marked, the words for it, and the sessions that work it.
struct LiftTargetingView: View {
    let targeting: LiftTargeting
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            LiftCaption(text: targeting.caption)
            if targeting.items.isEmpty {
                LiftCaption(text: targeting.emptyText)
            }
            VStack(alignment: .leading, spacing: Space.lg) {
                ForEach(targeting.items) { item in
                    LiftTargetRow(item: item, band: targeting.band, scaleMax: targeting.scaleMax, send: send)
                }
            }
            .koboCard()
        }
    }
}

private struct LiftTargetRow: View {
    @Environment(\.koboTheme) private var theme
    let item: LiftTargetMuscle
    let band: LiftBand
    let scaleMax: Double
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: item.name)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                Text(verbatim: item.text)
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(statusColor)
            }
            LiftTargetBar(done: item.done, planned: item.planned, band: band, scaleMax: scaleMax, color: statusColor)
                .accessibilityElement()
                .accessibilityLabel(Text(verbatim: item.label))
            if !item.sessions.isEmpty {
                FlowLayout(spacing: Space.xs) {
                    ForEach(item.sessions) { session in
                        Button {
                            send(.sessionTapped(session.sessionId))
                        } label: {
                            Label {
                                Text(verbatim: "\(session.dayText) · \(session.title) · \(session.setsText)")
                            } icon: {
                                Image(systemName: session.done ? "checkmark" : "calendar")
                            }
                            .font(theme.font(.caption))
                            .foregroundStyle(session.done ? theme.palette.textPrimary : theme.palette.textSecondary)
                            .padding(.horizontal, Space.sm)
                            .padding(.vertical, Space.xxs)
                            .glassEffect(.regular.interactive(), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    /// Green in the band, amber on track with what is planned, red short, blue over.
    private var statusColor: Color {
        switch item.status {
        case "inRange": theme.palette.success.ink
        case "onTrack": theme.palette.warning.ink
        case "above": theme.palette.info.ink
        default: theme.palette.danger.ink
        }
    }
}

/// One bar: done solid, planned faded after it, and the 10–20 band as two small marks under the bar.
private struct LiftTargetBar: View {
    @Environment(\.koboTheme) private var theme
    let done: Double
    let planned: Double
    let band: LiftBand
    let scaleMax: Double
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let scale = max(scaleMax, 1)
            let x = { (value: Double) in CGFloat(min(value, scale) / scale) * width }
            ZStack(alignment: .topLeading) {
                ZStack(alignment: .leading) {
                    Capsule().fill(theme.palette.surfaceSunken)
                    Capsule().fill(color.opacity(0.3)).frame(width: x(done + planned))
                    Capsule().fill(color).frame(width: x(done))
                }
                .frame(height: Space.sm)
                .clipShape(Capsule())
                bandMark.offset(x: x(band.min), y: Space.sm + Space.xxs)
                bandMark.offset(x: x(band.max), y: Space.sm + Space.xxs)
            }
        }
        .frame(height: Space.sm + Space.xs + Space.xxs)
    }

    private var bandMark: some View {
        Rectangle()
            .fill(theme.palette.textTertiary)
            .frame(width: Size.hairline * 3, height: Space.xs)
    }
}

/// Each focus lift: name, estimated 1RM now, the change over 8 weeks (coloured by direction), a PR mark, and a small
/// trend line. A tap opens the lift.
struct LiftProgressView: View {
    let progress: LiftProgress
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            LiftCaption(text: progress.caption)
            if progress.items.isEmpty {
                LiftCaption(text: progress.emptyText)
            } else {
                ListSection {
                    ForEach(progress.items) { lift in
                        LiftProgressRow(lift: lift) { send(.exerciseTapped(lift.exerciseKey)) }
                    }
                }
            }
        }
    }
}

private struct LiftProgressRow: View {
    @Environment(\.koboTheme) private var theme
    let lift: LiftProgressLift
    let onTap: () -> Void

    var body: some View {
        ListRow(verbatim: lift.name, subtitle: subtitle, action: onTap) {
            EmptyView()
        } trailing: {
            HStack(spacing: Space.md) {
                if lift.points.count > 1 {
                    Sparkline(
                        values: lift.points.map(\.e1rm),
                        color: toneColor,
                        verbatimAccessibilityLabel: "\(lift.name), \(lift.changeText ?? lift.e1rmText)"
                    )
                    .frame(width: Size.thumbnail, height: Size.iconLg)
                }
                VStack(alignment: .trailing, spacing: 0) {
                    Text(verbatim: lift.e1rmText)
                        .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    if let change = lift.changeText {
                        Text(verbatim: change)
                            .font(theme.font(.caption).monospacedDigit())
                            .foregroundStyle(toneColor)
                    }
                }
            }
        }
    }

    private var subtitle: String? {
        [lift.prText, lift.emptyText].compactMap(\.self).first
    }

    private var toneColor: Color {
        switch lift.tone {
        case "up": theme.palette.success.ink
        case "down": theme.palette.danger.ink
        default: theme.palette.textSecondary
        }
    }
}
