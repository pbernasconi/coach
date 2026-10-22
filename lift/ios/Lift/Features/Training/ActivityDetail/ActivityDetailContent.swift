import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view (SCR-2): the activity page.
struct ActivityDetailContent: View {
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        ActivityPage(state: state, send: send)
    }
}

/// One page that scrolls. Outdoors, the route map leads it edge to edge; a tap on the map, or a pull down past the
/// top, opens it to fill the screen. Summary cards open their full charts as pages. It keeps only view state: how far
/// the page is pulled, and the map's zoom.
private struct ActivityPage: View {
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void
    @Environment(\.koboTheme) private var theme
    @Namespace private var mapZoom
    /// How far the page is pulled down past its top: the map grows by this much.
    @State private var pull: CGFloat = 0

    private var detail: ActivityDetail? { state.detail.content.value }
    private var header: ActivityHeader? { detail?.header?.value }
    /// The route to lead with: outdoors only.
    private var heroRoute: ActivityRoute? {
        guard header?.outdoor == true, let route = detail?.route?.value, route.coordinates.count > 1 else { return nil }
        return route
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if let heroRoute {
                    ActivityHeroMap(route: heroRoute, pull: pull, zoom: mapZoom) { send(.mapExpandTapped) }
                }
                AppResourcePage(
                    state.detail,
                    onRetry: { send(.retryTapped) },
                    onConnect: { send(.connectTapped) },
                    showsFreshness: false
                ) { detail in
                    ActivitySections(detail: detail, feedback: state.shownFeedback, save: state.feedback.save, send: send)
                }
                .pageColumn()
                .padding(.top, heroRoute == nil ? Space.sm : Space.lg)
                .padding(.bottom, Space.xxl)
                .frame(maxWidth: .infinity)
                .background(alignment: .top) {
                    // Over the map, the page starts as a sheet with round top corners, as in Strava.
                    if heroRoute != nil {
                        UnevenRoundedRectangle(topLeadingRadius: Radius.lg, topTrailingRadius: Radius.lg)
                            .fill(theme.palette.canvas)
                    }
                }
                .padding(.top, heroRoute == nil ? 0 : -Radius.lg)
            }
        }
        .onScrollGeometryChange(for: CGFloat.self) { geometry in
            max(0, -(geometry.contentOffset.y + geometry.contentInsets.top))
        } action: { _, new in
            pull = new
            if heroRoute != nil, new > ActivityHeroMap.openPull { send(.mapExpandTapped) }
        }
        .ignoresSafeArea(edges: heroRoute == nil ? [] : .top)
        .scrollEdgeEffectHidden(heroRoute != nil, for: .top)
        .screenCanvas()
        // The page's header names the activity; the bar shows the name once the header scrolls away.
        .workoutBarTitle(header?.name, after: (heroRoute == nil ? 0 : ActivityHeroMap.height) + WorkoutBarTitle.defaultReveal)
        .workoutNeighbours(
            older: String(localized: "Older activity"),
            newer: String(localized: "Newer activity"),
            canGoOlder: header?.prevId != nil,
            canGoNewer: header?.nextId != nil,
            onOlder: { if let id = header?.prevId { send(.neighbourTapped(id)) } },
            onNewer: { if let id = header?.nextId { send(.neighbourTapped(id)) } }
        )
        .fullScreenCover(
            isPresented: Binding.action(state.destination == .map) { if !$0 { send(.destinationDismissed) } }
        ) {
            if let route = detail?.route?.value {
                ActivityFullMap(route: route, header: header, stats: detail?.overview?.value?.gridStats ?? []) {
                    send(.destinationDismissed)
                }
                .navigationTransition(.zoom(sourceID: ActivityHeroMap.zoomID, in: mapZoom))
            }
        }
        .workoutFeedbackComment(state.feedback, comment: state.shownFeedback?.comment) { send(.feedback($0)) }
        .navigationDestination(
            item: Binding.action(state.panel) { if $0 == nil { send(.destinationDismissed) } }
        ) { panel in
            if let detail {
                ActivityPanelPage(panel: panel, detail: detail, state: state, send: send)
            }
        }
    }
}
