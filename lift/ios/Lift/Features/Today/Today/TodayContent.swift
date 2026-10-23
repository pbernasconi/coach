import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: the date and Garmin lines, today's plan, then the web's Health page section by section, and the plan item
/// sheet (SCR-2).
struct TodayContent: View {
    let state: TodayState
    let send: (TodayAction) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                AppResourcePage(state.health, onRetry: { send(.retryTapped) }, onConnect: { send(.connectTapped) }) {
                    health in
                    TodaySections(today: state.today.content.value, health: health, range: state.range, send: send)
                } placeholder: {
                    TodaySkeleton()
                }
                .pageColumn()
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xxl)
            }
            .onChange(of: isSettled, initial: true) { _, settled in
                guard settled, let anchor = state.anchor else { return }
                // One turn later, once the loaded sections are laid out.
                Task { proxy.scrollTo(anchor, anchor: anchor == .end ? .bottom : .top) }
            }
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Today") }
        .planItemSheet(item: state.planItemTarget, onOpenActivity: { send(.planActivityTapped($0)) }) {
            send(.destinationDismissed)
        }
    }

    /// Both pages are in (today's plan may have failed): an anchor scroll no longer moves.
    private var isSettled: Bool {
        state.health.content.phase == .loaded && state.today.content.phase != .loading
    }
}

/// The page's sections in the web Health page's order, after today's plan. Each `{ok}` section fails alone.
struct TodaySections: View {
    /// Today's date line and plan; nil until it loads (or when it failed: the health page still shows).
    let today: AppToday?
    let health: AppHealth
    let range: HealthRange
    let send: (TodayAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            TodayHeaderView(dateText: today?.dateText, status: health.status.value)
            if let line = today?.todayLine {
                AppSectionView("Planned today", section: line) { line in TodayLineView(line: line, send: send) }
            }
            if let empty = health.emptyText {
                SectionEmptyCard(verbatim: empty, systemImage: "heart.text.square")
            } else {
                AppSectionView("Readiness", section: health.readiness) { TodayReadinessCard(readiness: $0) }
                AppSectionView("Vitals", section: health.vitals) { TodayVitalsView(vitals: $0) }
                AppSectionView("Trends", section: health.trends) { trends in
                    TodayTrendsView(trends: trends, range: range) { send(.trendRangeChanged($0)) }
                }
                .id(TodayAnchor.trends)
                AppSectionView("Body", section: health.body) { TodayBodyView(reading: $0) }
                AppSectionView("Labs", section: health.labs) { TodayLabsView(labs: $0) }
            }
            Color.clear.frame(height: 0).id(TodayAnchor.end)
        }
    }
}
