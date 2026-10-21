import KoboComponents
import KoboPatterns
import KoboTokens
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
            CardSection("Today") { Text("Kitchen remodel · 5 tasks") }
        case .listRow:
            VStack(spacing: 0) {
                ListRow(verbatim: "Book flights", subtitle: "Due Friday", value: "30 min", action: {})
                ListRow(verbatim: "Renew passport", subtitle: "Due in 3 weeks", value: "1 h", action: {}) {
                    Thumbnail(systemName: "doc.text", side: Size.minTouch)
                }
            }
        case .listSection:
            VStack(alignment: .leading, spacing: Space.xl) {
                ListSection("Flat", footer: "A page's top-level list: full-width rows on the keyline.") {
                    ListRow("Units", value: "km", action: {})
                    ListRow("Default timer", value: "25:00", action: {})
                }
                ListSection("Grouped", footer: "Forms and sheets: the card's edge on the keyline.") {
                    ListRow("Units", value: "km", action: {})
                    ListRow("Default timer", value: "25:00", action: {})
                }
                .listSectionStyle(.grouped)
            }
        case .keyValueList:
            KeyValueRow("Units", value: "km")
            KeyValueList(
                "Last trip",
                items: [
                    KeyValueItem("Nights", value: "4"),
                    KeyValueItem(verbatim: "Stay", value: "Guesthouse"),
                    KeyValueItem("Distance", value: "1,240 km"),
                    KeyValueItem("Under budget", value: "€60", valueTone: .success),
                ]
            )
        case .sectionHeader:
            SectionHeader("This week", subtitle: "2 of 3 planned", actionTitle: "Edit") {}
        case .separator:
            VStack(spacing: Space.sm) {
                Text("Above"); Separator(leadingInset: Space.lg); Text("Below")
            }
        case .collapsible:
            Collapsible("Packing list", subtitle: "3 items", isExpanded: $expanded) {
                Text("Passport · Charger · Umbrella")
            }
        case .pinnedFooter:
            ScrollView { Text("Scrolling content").frame(maxWidth: .infinity, minHeight: Size.minTouch * 4) }
                .frame(height: Size.minTouch * 5)
                .pinnedFooter { Button("Save trip") {}.buttonStyle(.kobo(.primary, width: .full)) }
        case .sheetHeader:
            SheetHeader(
                "Edit task",
                subtitle: "Book flights",
                onClose: {},
                confirm: SheetHeaderAction(accessibilityLabel: "Save") {}
            )
        case .dayStrip:
            DayStrip(items: sampleDays, today: today, week: $week, onSelect: { _ in })
        case .segmentedProgress:
            SegmentedProgress(done: 1, planned: 1, minimum: 2, goal: 3, accessibilityLabel: "Tasks this week")
        case .tileGrid:
            TileGrid([("Pages", "340"), ("Notes", "12"), ("Minutes", "95")], id: \.0) { stat in
                StatTile(verbatim: stat.0, value: stat.1)
            }
        case .miniPlayerBar:
            MiniPlayerBar(verbatim: "Focus timer", subtitle: "Write the report · 18:24", chrome: .floating, action: {})
            {
                Image(systemName: "timer").accessibilityHidden(true)
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
