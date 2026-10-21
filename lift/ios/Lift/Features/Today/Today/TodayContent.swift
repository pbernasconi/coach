import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: the date header, then the coach's Today page section by section, and the plan item sheet (SCR-2).
struct TodayContent: View {
    let state: TodayState
    let send: (TodayAction) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                AppResourcePage(state.today, onRetry: { send(.retryTapped) }, onConnect: { send(.connectTapped) }) {
                    today in
                    TodaySections(today: today, send: send)
                }
                .pageColumn()
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xxl)
            }
            .onChange(of: state.today.content.phase, initial: true) { _, phase in
                guard phase == .loaded, let anchor = state.anchor else { return }
                proxy.scrollTo(anchor, anchor: anchor == .end ? .bottom : .top)
            }
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Today") }
        .planItemSheet(item: state.planItemTarget, onOpenActivity: { send(.planActivityTapped($0)) }) {
            send(.destinationDismissed)
        }
    }
}

/// The page's sections in the web's order. Each `{ok}` section fails alone.
struct TodaySections: View {
    let today: AppToday
    let send: (TodayAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            TodayHeaderView(dateText: today.dateText, header: today.header, stale: today.stale)
            AppSectionView("Planned today", section: today.todayLine) { line in TodayLineView(line: line, send: send) }
            AppSectionView("Fitness", section: today.fitness) { fitness in TodayFitnessView(fitness: fitness) }
                .id(TodayAnchor.fitness)
            AppSectionView("Last 4 weeks", section: today.last4Weeks) { tiles in TodayTilesView(tiles: tiles.tiles) }
            AppSectionView("Body", section: today.body) { body in TodayBodyView(reading: body) }
            AppSectionView("Lift", section: today.lift) { lift in TodayLiftView(lift: lift, send: send) }
            AppSectionView("Goals", section: today.goals) { goals in TodayGoalsView(goals: goals) }
            Color.clear.frame(height: 0).id(TodayAnchor.end)
        }
    }
}
