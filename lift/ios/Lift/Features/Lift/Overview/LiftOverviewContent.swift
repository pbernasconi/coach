import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view (SCR-2): the Lift tab's overview, kept short (focus, targeting, progress); the full lists are in History
/// and Exercises. A coach note that points at the muscles scrolls there.
struct LiftOverviewContent: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let state: LiftOverviewState
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                AppResourcePage(state.overview, onRetry: { send(.retryTapped) }, onConnect: { send(.connectTapped) }) {
                    overview in
                    LiftOverviewSections(overview: overview, state: state, send: send)
                } placeholder: {
                    LiftOverviewSkeleton()
                }
                .pageColumn()
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xxl)
            }
            .onChange(of: state.scrollTarget) { _, target in
                guard let target else { return }
                withAnimation(Motion.navigate.animation(reduceMotion: reduceMotion)) {
                    proxy.scrollTo(target.section, anchor: .top)
                }
            }
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Lift") }
    }
}

/// The simple overview, top to bottom: this week in one line and the next session, the focus muscles and how this
/// week's sessions target them, the focus lifts' progress, and at most one coach note. Each `{ok}` section fails
/// alone. With nothing logged yet, the server's empty text stands in for all of them.
struct LiftOverviewSections: View {
    let overview: LiftOverview
    let state: LiftOverviewState
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let empty = overview.empty {
                EmptyState(symbol: "dumbbell", verbatim: empty.title, message: empty.body)
            } else {
                if let summary = overview.summary {
                    AppSectionView(nil, section: summary) { LiftWeekLine(summary: $0, send: send) }
                }
                if let targeting = overview.targeting {
                    AppSectionView("Focus this week", section: targeting) { LiftTargetingView(targeting: $0, send: send) }
                        .id(LiftOverviewSection.muscles)
                }
                if let progress = overview.progress {
                    AppSectionView("Progress", section: progress) { LiftProgressView(progress: $0, send: send) }
                }
                if let note = overview.note?.value?.item {
                    LiftTipsView(tips: LiftTips(title: "", items: [note]), send: send)
                }
            }
        }
    }
}

/// A server caption under a section title: quiet footnote text, shown as is.
struct LiftCaption: View {
    @Environment(\.koboTheme) private var theme
    let text: String

    var body: some View {
        Text(verbatim: text)
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A plain "YYYY-MM-DD" day from the server as the start of that day in `calendar`; nil when it does not parse.
nonisolated enum LiftDay {
    static func date(_ plain: String, calendar: Calendar) -> Date? {
        CoachPlanDates.day(fromPlain: plain).flatMap { DayCalendar(calendar: calendar).date(of: $0) }
    }
}
