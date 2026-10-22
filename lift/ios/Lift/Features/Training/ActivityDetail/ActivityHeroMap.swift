import KoboComponents
import KoboTokens
import SwiftUI

/// The route edge to edge at the top of an outdoor activity, under the bar. It grows as the page is pulled down, and
/// a tap opens it to fill the screen (with a zoom from here).
struct ActivityHeroMap: View {
    /// The map's height at rest, under the bar.
    static let height: CGFloat = 340
    /// A pull down this far past the top opens the map.
    static let openPull: CGFloat = 110
    static let zoomID = "route"

    let route: ActivityRoute
    let pull: CGFloat
    let zoom: Namespace.ID
    let onOpen: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Button(action: onOpen) {
            KoboRouteMap(
                points: route.coordinates,
                color: theme.palette.info.ink,
                bleeds: true,
                accessibilityLabel: "Route map"
            )
            // The page's round top covers the map's bottom edge: keep the Maps label above it.
            .safeAreaPadding(.bottom, Radius.lg)
            .allowsHitTesting(false)
        }
        .buttonStyle(.plain)
        .accessibilityHint(Text("Opens the map full screen"))
        .matchedTransitionSource(id: Self.zoomID, in: zoom)
        .frame(height: Self.height + pull)
        .offset(y: -pull)
    }
}

/// The route on a map that fills the screen and pans and zooms, with the activity's name and first numbers over it.
/// The close button, or a swipe down, goes back to the page.
struct ActivityFullMap: View {
    let route: ActivityRoute
    let header: ActivityHeader?
    let stats: [ActivityOverview.Stat]
    let onClose: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        KoboRouteMap(
            points: route.coordinates,
            interaction: .interactive,
            color: theme.palette.info.ink,
            bleeds: true,
            accessibilityLabel: "Route map"
        )
        .ignoresSafeArea()
        .overlay(alignment: .topLeading) {
            IconButton("xmark", accessibilityLabel: "Close map", style: .glass, action: onClose)
                .padding(.horizontal, Space.md)
        }
        .overlay(alignment: .bottom) { summary }
    }

    @ViewBuilder private var summary: some View {
        if let header {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(verbatim: header.name)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                HStack(alignment: .top, spacing: Space.md) {
                    ForEach(stats.prefix(3), id: \.label) { stat in
                        WorkoutStatCell(label: stat.label, value: stat.valueText, unit: stat.unit, size: .compact)
                    }
                }
            }
            .padding(Space.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            .padding(.horizontal, Space.md)
            .padding(.bottom, Space.sm)
        }
    }
}
