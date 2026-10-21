import KoboComponents
import KoboTokens
import SwiftUI

/// The page's title block: the sport, name, when and where, Strava's description, the "still loading" note, the
/// older and newer activity, and "Open on Strava".
struct ActivityHeaderView: View {
    let header: ActivityHeader
    let send: (ActivityDetailAction) -> Void
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                Label {
                    Text(verbatim: header.typeText)
                } icon: {
                    header.sportStyle.icon
                }
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                if header.indoor { KoboTag("Indoor", tone: .neutral) }
                if header.commute { KoboTag("Commute", tone: .neutral) }
            }
            Text(verbatim: header.name)
                .font(theme.font(.title))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            // When and where; the sport is already named above.
            Text(verbatim: [header.whenText, header.place].compactMap(\.self).joined(separator: " · "))
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
            if let description = header.description, !description.isEmpty {
                Text(verbatim: description)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
            }
            if let note = header.fetch.note {
                InlineNotice(verbatim: note, tone: header.fetch.pending ? .info : .warning)
            }
            actions
        }
    }

    /// The arrows and the Strava button on one row; at accessibility sizes the button goes under the arrows.
    private var actions: some View {
        let layout =
            dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
            : AnyLayout(HStackLayout(spacing: Space.sm))
        return layout {
            HStack(spacing: Space.sm) { arrows }
            if !dynamicTypeSize.isAccessibilitySize { Spacer(minLength: 0) }
            if let url = URL(string: header.stravaUrl) {
                Link(destination: url) {
                    Label("Open on Strava", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.kobo(.secondary))
            }
        }
    }

    @ViewBuilder private var arrows: some View {
        if let older = header.prevId {
            IconButton("chevron.left", accessibilityLabel: "Older activity", style: .tonal) {
                send(.neighbourTapped(older))
            }
        }
        if let newer = header.nextId {
            IconButton("chevron.right", accessibilityLabel: "Newer activity", style: .tonal) {
                send(.neighbourTapped(newer))
            }
        }
    }
}
