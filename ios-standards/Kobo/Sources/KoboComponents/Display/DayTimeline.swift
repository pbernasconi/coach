import KoboTokens
import SwiftUI

/// A day as a list of time blocks: each row has its range, a bar for its kind and what fills it. Busy time is a quiet
/// grey bar, free time a green bar with its length ("Free · 4 h 30"), and the highlighted block an accent bar in bold.
/// VoiceOver reads each row as one element: "09:00 to 10:15, busy, Team review".
///
///     DayTimeline([
///         DayTimelineBlock(id: "1", start: "09:00", end: "10:15", kind: .busy, title: "Team review"),
///         DayTimelineBlock(id: "2", start: "10:15", end: "13:30", kind: .free),
///     ])
public struct DayTimeline: View {
    private let blocks: [DayTimelineBlock]

    public init(_ blocks: [DayTimelineBlock]) {
        self.blocks = DayTimelineMath.ordered(blocks)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            ForEach(blocks) { DayTimelineRow(block: $0) }
        }
    }
}

private struct DayTimelineRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var timeWidth = Space.xxxl * 2 + Space.lg
    let block: DayTimelineBlock

    var body: some View {
        HStack(alignment: .center, spacing: Space.md) {
            Text(verbatim: "\(block.start)–\(block.end)")
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: timeWidth, alignment: .leading)
            RoundedRectangle(cornerRadius: Space.xxs)
                .fill(barColor)
                .frame(width: Space.xs)
                .frame(maxHeight: .infinity)
            label
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, Space.xxs)
        .frame(minHeight: Size.minTouch - Space.sm)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
    }

    @ViewBuilder
    private var label: some View {
        switch block.kind {
        case .busy:
            Text(verbatim: block.title ?? String(localized: "Busy", bundle: .module))
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textPrimary)
        case .free:
            Text(verbatim: freeText)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.success.ink)
        case .highlight:
            Text(verbatim: block.title ?? "")
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
        }
    }

    private var freeText: String {
        let free = String(localized: "Free", bundle: .module)
        guard let length = DayTimelineMath.lengthText(start: block.start, end: block.end) else { return free }
        return "\(free) · \(length)"
    }

    private var barColor: Color {
        switch block.kind {
        case .busy: theme.palette.surfaceSunken
        case .free: theme.palette.success.ink
        case .highlight: theme.palette.accent
        }
    }

    private var spoken: Text {
        let kind: Text =
            switch block.kind {
            case .busy: Text("busy", bundle: .module)
            case .free: Text("free", bundle: .module)
            case .highlight: Text("planned", bundle: .module)
            }
        let title = block.title.map { Text(verbatim: ", \($0)") } ?? Text(verbatim: "")
        return Text("\(block.start) to \(block.end), \(kind)\(title)", bundle: .module)
    }
}

#if DEBUG
    private struct DayTimelinePreview: View {
        var body: some View {
            DayTimeline([
                DayTimelineBlock(id: "1", start: "08:00", end: "08:30", kind: .busy, title: "Call with the landlord"),
                DayTimelineBlock(id: "2", start: "08:30", end: "13:30", kind: .free),
                DayTimelineBlock(id: "3", start: "09:00", end: "10:15", kind: .highlight, title: "Pottery class"),
                DayTimelineBlock(id: "4", start: "13:30", end: "17:00", kind: .busy, title: "Train to the coast"),
            ])
            .padding(Space.gutter)
            .koboCard()
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Day timeline") { DayTimelinePreview() }
    #Preview("Day timeline · dark") { DayTimelinePreview().preferredColorScheme(.dark) }
    #Preview("Day timeline · AX3") { DayTimelinePreview().dynamicTypeSize(.accessibility3) }
#endif
