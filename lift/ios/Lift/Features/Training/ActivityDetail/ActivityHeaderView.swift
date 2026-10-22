import KoboComponents
import KoboTokens
import SwiftUI

/// The page's title block, the shared workout header: the sport and when, the name, "Done" with the Indoor and Commute
/// tags, then the place, Strava's description, the "still loading" note and "Open on Strava". The older and newer
/// arrows are in the bar (`ActivityDetailContent`), as on every workout page.
struct ActivityHeaderView: View {
    let header: ActivityHeader
    let send: (ActivityDetailAction) -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        WorkoutHeader(
            sport: header.sportStyle,
            kicker: [header.typeText, header.whenText].joined(separator: " · "),
            title: header.name,
            status: .done,
            statusLabel: String(localized: "Done"),
            tags: tags
        ) {
            if let place = header.place {
                Text(verbatim: place)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if let description = header.description, !description.isEmpty {
                Text(verbatim: description)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
            }
            if let note = header.fetch.note {
                InlineNotice(verbatim: note, tone: header.fetch.pending ? .info : .warning)
            }
            if let url = URL(string: header.stravaUrl) {
                Link(destination: url) {
                    Label("Open on Strava", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.kobo(.secondary))
                .padding(.top, Space.xs)
            }
        }
    }

    private var tags: [String] {
        [header.indoor ? String(localized: "Indoor") : nil, header.commute ? String(localized: "Commute") : nil]
            .compactMap(\.self)
    }
}
