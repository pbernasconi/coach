import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: the coach's Lift page section by section, as the web's /lift shows it (SCR-2). A coach tip that points at
/// a section scrolls there.
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

/// The sections in the web's order; each `{ok}` section fails alone. With nothing logged yet, the server's empty text
/// stands in for all of them.
struct LiftOverviewSections: View {
    let overview: LiftOverview
    let state: LiftOverviewState
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let empty = overview.empty {
                EmptyState(symbol: "dumbbell", verbatim: empty.title, message: empty.body)
            } else {
                AppSectionView(nil, section: overview.week) { week in LiftWeekHero(week: week, send: send) }
                if overview.tips.value?.items.isEmpty != true {
                    AppSectionView("Coach notes", section: overview.tips) { tips in LiftTipsView(tips: tips, send: send)
                    }
                }
                AppSectionView("Main lifts", section: overview.lifts) { lifts in
                    LiftMainLiftsView(lifts: lifts, send: send)
                }
                AppSectionView("Muscles", section: overview.muscles) { LiftMusclesView(muscles: $0) }
                    .id(LiftOverviewSection.muscles)
                AppSectionView("Sessions", section: overview.sessions) { sessions in
                    LiftSessionsView(sessions: sessions, isExpanded: state.isOlderSessionsExpanded, send: send)
                }
                .id(LiftOverviewSection.sessions)
                AppSectionView("Consistency", section: overview.consistency) { LiftConsistencyView(consistency: $0) }
                    .id(LiftOverviewSection.consistency)
                AppSectionView("Records", section: overview.records) { LiftRecordsView(records: $0, send: send) }
                    .id(LiftOverviewSection.records)
                AppSectionView("Exercises", section: overview.exercises) { exercises in
                    LiftExerciseIndexView(exercises: exercises, isExpanded: state.isExercisesExpanded, send: send)
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
