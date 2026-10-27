import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Display section.
struct DisplayDemo: View {
    let component: CatalogComponent
    @State private var progress = 0.4
    @State private var steps = 12_450.0
    @State private var timerStart = Date.now  // ios-guard: allow catalog demo reads the clock once

    var body: some View {
        switch component {
        case .progressRing:
            VStack(spacing: Space.md) {
                ProgressRing(progress: progress) { Text(progress, format: .percent.precision(.fractionLength(0))) }
                    .frame(width: Size.minTouch * 2, height: Size.minTouch * 2)
                Slider(value: $progress, in: 0...1) { Text("Progress") }
            }
        case .countdownRing:
            VStack(spacing: Space.md) {
                CountdownRing(
                    start: timerStart,
                    end: timerStart.addingTimeInterval(90),
                    accessibilityLabel: "Tea timer"
                )
                .frame(width: Size.minTouch * 3, height: Size.minTouch * 3)
                Button("Restart") { timerStart = .now }  // ios-guard: allow catalog demo
                    .buttonStyle(.kobo(.secondary))
            }
        case .animatedNumber:
            VStack(alignment: .leading, spacing: Space.sm) {
                AnimatedNumber(steps, format: .number.precision(.fractionLength(0))).font(.largeTitle)
                Button("Add a walk") { steps += 1_080 }.buttonStyle(.kobo(.secondary))
            }
        case .statTile:
            HStack(spacing: Space.md) {
                StatTile(label: "Steps", value: steps, unit: "today", delta: StatDelta(verbatim: "+8%", tone: .success))
                StatTile(label: "Walks", value: "2", delta: StatDelta("on track", tone: .neutral))
            }
        case .avatar:
            HStack(spacing: Space.md) {
                Avatar(name: "Sam Rivera", diameter: .small)
                Avatar(name: "Alex Kim")
                Avatar(name: "Jo Park", diameter: .large)
            }
        case .thumbnail:
            HStack(spacing: Space.md) {
                Thumbnail(systemName: "book.closed", tone: .accent)
                Thumbnail(systemName: "play.rectangle", tone: .info, accessibilityLabel: "Video") {
                    ThumbnailBadge()
                }
            }
        case .dayTimeline:
            DayTimeline([
                DayTimelineBlock(id: "1", start: "08:00", end: "08:30", kind: .busy, title: "Call with the landlord"),
                DayTimelineBlock(id: "2", start: "08:30", end: "13:30", kind: .free),
                DayTimelineBlock(id: "3", start: "09:00", end: "10:15", kind: .highlight, title: "Pottery class"),
                DayTimelineBlock(id: "4", start: "13:30", end: "17:00", kind: .busy, title: "Train to the coast"),
            ])
        default: EmptyView()
        }
    }
}
