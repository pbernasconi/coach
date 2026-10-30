import AppIntents
import SwiftUI
import WidgetKit

/// The Coach widget on the Home Screen (small and medium) and the Lock Screen: fitness, form and fatigue, and today's
/// workouts. It fetches the coach's Today page itself about once an hour, and the app asks for a fresh one each time
/// it goes to the background. A tap opens Today; a medium widget's workout row opens that workout's Lift session.
struct HomeWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: "CoachToday",
            intent: HomeWidgetIntent.self,
            provider: HomeWidgetProvider()
        ) { entry in
            HomeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Coach")
        .description("Fitness, form and fatigue, and today's workouts.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

/// The widget has nothing to set; an intent with no parameters keeps the async timeline provider.
nonisolated struct HomeWidgetIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Coach today"
    static let isDiscoverable = false
}

/// One entry now, and the next refresh in an hour or just after midnight, whichever comes first.
nonisolated struct HomeWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in _: Context) -> HomeWidgetEntry {
        HomeWidgetEntry(date: .now, snapshot: .sample, notice: nil)
    }

    func snapshot(for _: HomeWidgetIntent, in context: Context) async -> HomeWidgetEntry {
        // The widget gallery shows the made-up day, so it never waits for the network.
        if context.isPreview { return placeholder(in: context) }
        return await HomeWidgetLoader.live().entry(now: .now, calendar: .current)
    }

    func timeline(for _: HomeWidgetIntent, in _: Context) async -> Timeline<HomeWidgetEntry> {
        let now = Date.now
        let calendar = Calendar.current
        let entry = await HomeWidgetLoader.live().entry(now: now, calendar: calendar)
        let hourLater = now.addingTimeInterval(60 * 60)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? hourLater
        let next = min(hourLater, tomorrow.addingTimeInterval(60))
        return Timeline(entries: [entry], policy: .after(next))
    }
}

/// Picks the face for the widget's size and puts it on the system's background.
struct HomeWidgetEntryView: View {
    let entry: HomeWidgetEntry

    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        face
            .widgetURL(URL(string: "lift://today"))
            .containerBackground(for: .widget) {
                if family == .accessoryRectangular {
                    Color.clear
                } else {
                    HomeWidgetColors.background(scheme)
                }
            }
    }

    @ViewBuilder private var face: some View {
        switch family {
        case .systemSmall:
            HomeWidgetSmallView(snapshot: entry.snapshot, notice: entry.notice)
        case .accessoryRectangular:
            HomeWidgetRectangularView(snapshot: entry.snapshot, notice: entry.notice)
        default:
            HomeWidgetMediumView(snapshot: entry.snapshot, notice: entry.notice)
        }
    }
}
