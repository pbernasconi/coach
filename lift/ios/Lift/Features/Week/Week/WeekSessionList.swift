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
            EmptyState(symbol: "calendar", title: "No workouts", message: "Nothing is planned for this week.")
        case .failed:
            ErrorState(title: "Workouts could not be loaded")
        case .loaded(let sections):
            ForEach(sections) { section in
                WeekDaySectionView(section: section, send: send)
                    .id(section.id)
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
        } header: {
            header
        }
    }

    private var header: some View {
        HStack(spacing: Space.xs) {
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
