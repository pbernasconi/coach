import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The date, the recovery and fitness chips (each a toned pill with its text, never colour alone) and the stale-data
/// notice. The chips are plain values: the web links them to Health, the phone does not.
struct TodayHeaderView: View {
    @Environment(\.koboTheme) private var theme
    let dateText: String
    let header: AppSection<TodayHeader>
    let stale: AppSection<TodayStale>

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: dateText)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityAddTraits(.isHeader)
            if let header = header.value {
                if header.chips.isEmpty, let empty = header.emptyText {
                    Text(verbatim: empty)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textTertiary)
                } else {
                    FlowLayout(spacing: Space.sm, lineSpacing: Space.sm) {
                        ForEach(header.chips) { chip in TodayChipView(chip: chip) }
                    }
                }
            }
            if let text = stale.value?.text {
                InlineNotice(verbatim: text, tone: .warning)
            }
        }
    }
}

/// "Readiness" over "56 · Moderate", with the tone's dot.
struct TodayChipView: View {
    @Environment(\.koboTheme) private var theme
    let chip: TodayChip

    var body: some View {
        HStack(spacing: Space.sm) {
            Circle()
                .fill(theme.palette.status(chip.tone.kobo).ink)
                .frame(width: Space.sm, height: Space.sm)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: chip.label)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: chip.valueText)
                    .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
            }
        }
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.sm)
        .background(theme.palette.surface, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

/// Today's planned workouts: a lift opens its session, another workout its detail. The readiness cue sits under them.
struct TodayLineView: View {
    @Environment(\.koboTheme) private var theme
    let line: TodayLine
    let send: (TodayAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ListSection {
                if line.items.isEmpty {
                    ListRow(verbatim: line.emptyText ?? String(localized: "Nothing planned")) {
                        Sport.rest.icon.font(theme.font(.headline))
                    }
                    .listRowEmphasis(.quiet)
                }
                ForEach(line.items) { item in
                    let sport = Sport(rawValue: item.sport) ?? .other
                    ListRow(verbatim: item.title, subtitle: item.text, action: { send(.lineItemTapped(item.id)) }) {
                        sport.icon.font(theme.font(.headline)).frame(width: Size.iconLg)
                    }
                    .accessibilityLabel(Text(verbatim: "\(sport.label): \(item.title)"))
                    .accessibilityValue(Text(verbatim: item.text))
                }
            }
            if let cue = line.cue {
                InlineNotice(verbatim: cue, tone: .info)
            }
        }
    }
}

/// The four complete weeks before this one: time, run, ride and strength, two to a row (one at accessibility sizes).
struct TodayTilesView: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let tiles: [TodayTile]

    var body: some View {
        if tiles.isEmpty {
            SectionEmptyCard(
                "No training yet",
                caption: "Weeks show here once they are complete.",
                systemImage: "clock"
            )
        } else {
            LazyVGrid(columns: columns, alignment: .leading, spacing: Space.sm) {
                ForEach(tiles) { tile in
                    StatTile(verbatim: tile.label, value: tile.valueText) {
                        if let note = tile.noteText {
                            TodayTileNote(note: note, sport: tile.sport.flatMap(Sport.init(rawValue:)))
                        }
                    }
                }
            }
        }
    }

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: Space.sm), count: typeSize.isAccessibilitySize ? 1 : 2)
    }
}

/// A tile's note, after its sport's icon.
private struct TodayTileNote: View {
    @Environment(\.koboTheme) private var theme
    let note: String
    let sport: Sport?

    var body: some View {
        HStack(spacing: Space.xs) {
            if let sport { sport.icon }
            Text(verbatim: note)
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
    }
}
