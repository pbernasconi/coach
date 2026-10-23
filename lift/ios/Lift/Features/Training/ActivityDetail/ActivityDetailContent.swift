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

/// One page. Outdoors, the route on a map fills the screen under a sheet with the page (`ActivityMapPage`, as in
/// Strava); otherwise the page scrolls under the bar. Summary cards open their full charts as pages.
private struct ActivityPage: View {
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void

    private var detail: ActivityDetail? { state.detail.content.value }
    private var header: ActivityHeader? { detail?.header?.value }
    /// The route to lead with: outdoors only.
    private var heroRoute: ActivityRoute? {
        guard header?.outdoor == true, let route = detail?.route?.value, route.coordinates.count > 1 else { return nil }
        return route
    }

    var body: some View {
        Group {
            if let heroRoute, let header, let detail {
                ActivityMapPage(route: heroRoute, header: header, detail: detail, state: state, send: send)
            } else {
                ActivityScrollPage(state: state, title: header?.name, send: send)
            }
        }
        .workoutNeighbours(
            older: String(localized: "Older activity"),
            newer: String(localized: "Newer activity"),
            canGoOlder: header?.prevId != nil,
            canGoNewer: header?.nextId != nil,
            onOlder: { if let id = header?.prevId { send(.neighbourTapped(id)) } },
            onNewer: { if let id = header?.nextId { send(.neighbourTapped(id)) } }
        )
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

/// The page with no map: it loads, and scrolls under the bar, which shows the name once the header has gone.
private struct ActivityScrollPage: View {
    let state: ActivityDetailState
    let title: String?
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.detail,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) },
                showsFreshness: false
            ) { detail in
                ActivitySections(detail: detail, feedback: state.shownFeedback, save: state.feedback.save, send: send)
            } placeholder: {
                ActivityDetailSkeleton()
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .workoutBarTitle(title)
    }
}
