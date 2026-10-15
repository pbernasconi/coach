import CraftComponents
import CraftTokens
import SwiftUI

/// Live demos for the Layout section.
struct LayoutDemo: View {
    let component: CatalogComponent
    @State private var expanded = false
    @State private var week = 0
    @State private var today = Date.now  // ios-guard: allow catalog demo reads the clock once
    @Environment(\.calendar) private var calendar

    var body: some View {
        switch component {
        case .card:
            CardSection("Today") { Text("Lower A · 5 exercises") }
        case .listRow:
            VStack(spacing: 0) {
                ListRow("Back squat", subtitle: "3 × 8", value: "135 lb", action: {})
                ListRow("Romanian deadlift", subtitle: "3 × 10", value: "115 lb", action: {}) {
                    Thumbnail(systemName: "figure.strengthtraining.traditional", side: Size.minTouch)
                }
            }
        case .listSection:
            ListSection("Settings", footer: "Sets log after the rest timer.") {
                ListRow("Units", value: "lb", action: {})
                ListRow("Rest timer", value: "2:00", action: {})
            }
        case .keyValueList:
            KeyValueRow("Units", value: "lb")
            KeyValueList(
                "Last session",
                items: [
                    KeyValueItem("Top set", value: "155 × 6"),
                    KeyValueItem("Volume", value: "9,840 lb"),
                    KeyValueItem("Change", value: "+5 lb", valueTone: .success),
                ]
            )
        case .sectionHeader:
            SectionHeader("This week", subtitle: "2 of 3 planned", actionTitle: "Edit") {}
        case .separator:
            VStack(spacing: Space.sm) {
                Text("Above"); Separator(leadingInset: Space.lg); Text("Below")
            }
        case .collapsible:
            Collapsible("Warm-up sets", subtitle: "3 sets", isExpanded: $expanded) {
                Text("45 × 10 · 95 × 5 · 115 × 3")
            }
        case .pinnedFooter:
            ScrollView { Text("Scrolling content").frame(maxWidth: .infinity, minHeight: Size.minTouch * 4) }
                .frame(height: Size.minTouch * 5)
                .pinnedFooter { Button("Start workout") {}.buttonStyle(.craft(.primary, width: .full)) }
        case .sheetHeader:
            SheetHeader(
                "Edit set",
                subtitle: "Back squat",
                closeAccessibilityLabel: "Close",
                onClose: {},
                confirm: SheetHeaderAction(accessibilityLabel: "Save") {}
            )
        case .dayStrip:
            DayStrip(items: sampleDays, today: today, week: $week, onSelect: { _ in })
        case .segmentedProgress:
            SegmentedProgress(done: 1, planned: 1, required: 0, goal: 3, accessibilityLabel: "Sessions this week")
        case .miniPlayerBar:
            MiniPlayerBar(title: "Back squat", subtitle: "Set 2 of 3 · 1:24", chrome: .floating, action: {}) {
                Image(systemName: "figure.strengthtraining.traditional").accessibilityHidden(true)
            }
        default: EmptyView()
        }
    }

    private var sampleDays: [DayItem] {
        [-2, 0, 2].compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: today).map { date in
                DayItem(date: date, marker: offset < 0 ? .done(.accent) : .planned(.accent))
            }
        }
    }
}
