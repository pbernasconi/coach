import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The visible week's sessions grouped by day, scrolled so the selected day sits at the top; or why there are none.
struct WeekSessionList: View {
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
            .onChange(of: selectedDay, initial: true) { _, day in
                guard let day else { return }
                proxy.scrollTo(day, anchor: .top)
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch state.sessions {
        case .loading:
            LoadingState()
        case .empty:
            WeekEmptyState(hasTemplates: !state.templates.isEmpty, send: send)
        case .failed:
            ErrorState(title: "Workouts could not be loaded")
        case .loaded(let sections):
            ForEach(sections) { section in
                WeekDaySectionView(section: section, send: send)
                    .id(section.id)
            }
            if state.canPlanNextWeek {
                WeekPlanNextRow(send: send)
            }
        }
    }

    private var selectedDay: LocalDay? {
        guard case .loaded(let sections) = state.sessions else { return nil }
        return sections.first(where: \.isSelected)?.id
    }
}

/// One day: its header (accented and marked when selected) and its sessions, or a quiet placeholder row when it has
/// none.
private struct WeekDaySectionView: View {
    @Environment(\.koboTheme) private var theme
    let section: WeekDaySection
    let send: (WeekAction) -> Void

    var body: some View {
        ListSection {
            if section.sessions.isEmpty {
                ListRow("Nothing planned", subtitle: "Rest day") { WeekRowMark(kind: .empty) }
                    .listRowEmphasis(.quiet)
            }
            ForEach(section.sessions) { session in
                WeekSessionRow(session: session, send: send)
            }
            if section.isSelected {
                ListRow("Add workout", action: { send(.addWorkoutTapped(section.id)) }) { WeekRowMark(kind: .add) }
            }
        } header: {
            header
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            if section.isSelected {
                // A fill, so the bright accent, like the strip's day dots; the title beside it is text (accentText).
                Image(systemName: "circle.fill")
                    .imageScale(.small)
                    .foregroundStyle(theme.palette.accent)
                    .accessibilityHidden(true)
            }
            Text(verbatim: section.title)
                .foregroundStyle(section.isSelected ? theme.palette.accentText : theme.palette.textSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(section.isSelected ? .isSelected : [])
    }
}

/// "Plan next week": copies the visible week's template days a week forward, with Undo in a toast.
private struct WeekPlanNextRow: View {
    let send: (WeekAction) -> Void

    var body: some View {
        ListSection {
            ListRow(
                "Plan next week",
                subtitle: "Copy this week's template workouts to the same days",
                action: { send(.planNextWeekTapped) }
            ) {
                WeekRowMark(kind: .plan)
            }
        }
    }
}

/// A week with nothing planned. Without templates yet (a first launch), it points to making one, which is how days get
/// planned; a blank workout is the other way in.
private struct WeekEmptyState: View {
    let hasTemplates: Bool
    let send: (WeekAction) -> Void

    var body: some View {
        if hasTemplates {
            EmptyState(symbol: "calendar", title: "No workouts", message: "Nothing is planned for this week.") {
                Button("Add workout", systemImage: "plus") { send(.addWorkoutTapped(nil)) }
                    .buttonStyle(.kobo(.primary))
            }
        } else {
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
}
