import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The visible week as seven rows, one per day, Monday first, under the coach plan's line when sync is on; a day
/// without rows is a rest day. Picking a day brings its row into view; or, on a first launch, where to start.
struct WeekSessionList: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let state: WeekState
    let send: (WeekAction) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Space.section) {
                    content
                }
                .pageColumn()
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xxl)
            }
            .onChange(of: selectedDay) { _, day in
                guard let day else { return }
                // No anchor: scroll only as far as needed to show the row.
                withAnimation(reduceMotion ? nil : .snappy) { proxy.scrollTo(day) }
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch state.sessions {
        case .loading:
            LoadingState()
        case .empty:
            WeekFirstRunState(send: send)
        case .failed:
            ErrorState(title: "Workouts could not be loaded")
        case .loaded(let days):
            if state.templates.isEmpty && days.allSatisfy(\.entries.isEmpty) {
                WeekFirstRunState(send: send)
            } else {
                if let plan = state.plan {
                    WeekPlanSummary(plan: plan)
                }
                ListSection {
                    ForEach(days) { day in
                        WeekDayRows(day: day, showsSports: state.plan != nil, send: send)
                            .id(day.id)
                    }
                }
            }
        }
    }

    private var selectedDay: LocalDay? {
        guard case .loaded(let days) = state.sessions else { return nil }
        return days.first(where: \.isSelected)?.id
    }
}

/// A first launch: no templates and nothing planned. Days get planned from templates, so it points to making one; a
/// blank workout is the other way in.
private struct WeekFirstRunState: View {
    let send: (WeekAction) -> Void

    var body: some View {
        EmptyState(
            symbol: "calendar",
            title: "No workouts yet",
            message: "Make a template, such as Upper A, then plan days from it here."
        ) {
            Button("New template", systemImage: "list.bullet.rectangle") { send(.newTemplateTapped) }
                .buttonStyle(.kobo(.primary))
            Button("Blank workout", systemImage: "plus") { send(.addWorkoutTapped(nil)) }
                .buttonStyle(.kobo(.secondary))
        }
    }
}
