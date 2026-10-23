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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var detail: ActivityDetail? { state.detail.content.value }
    private var header: ActivityHeader? { detail?.header?.value }
    /// The route to lead with: outdoors only.
    private var heroRoute: ActivityRoute? {
        guard header?.outdoor == true, let route = detail?.route?.value, route.coordinates.count > 1 else { return nil }
        return route
    }

    /// The map layout: once loaded, when there is a route to lead with; before, when the list said it is outdoors.
    private var leadsWithMap: Bool {
        detail == nil ? state.seed?.outdoor == true : heroRoute != nil
    }

    var body: some View {
        Group {
            // The list's guess can be wrong (an outdoor activity whose track Strava has not sent yet): the layout then
            // crossfades, it does not cut.
            if leadsWithMap {
                ActivityMapPage(route: heroRoute, state: state, send: send)
                    .transition(Motion.crossFade(reduceMotion: reduceMotion))
            } else {
                ActivityScrollPage(state: state, title: header?.name ?? state.plan?.title, send: send)
                    .transition(Motion.crossFade(reduceMotion: reduceMotion))
            }
        }
        .koboAnimation(.crossfade, value: leadsWithMap)
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

/// The page with no map: it loads, and scrolls under the bar, which shows the name once the header has gone. A workout
/// still to do shows its plan; a done one what was done, with the plan's cards in it.
private struct ActivityScrollPage: View {
    let state: ActivityDetailState
    let title: String?
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.workout,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { workout in
                if let activity = workout.activity {
                    ActivitySections(
                        detail: activity,
                        plan: workout.plan,
                        feedback: state.shownFeedback,
                        save: state.feedback.save,
                        send: send
                    )
                } else if let plan = workout.plan {
                    WorkoutPlanSections(workout: plan, feedback: state.shownFeedback, save: state.feedback.save, send: send)
                }
            } placeholder: {
                ActivityDetailSkeleton(seed: state.seed)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .workoutBarTitle(title)
    }
}
