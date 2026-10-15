import CraftComponents
import CraftTokens
import SwiftUI

/// Live demos for the Display section.
struct DisplayDemo: View {
    let component: CatalogComponent
    @State private var progress = 0.4
    @State private var volume = 12_450.0
    @State private var restStart = Date.now  // ios-guard: allow catalog demo reads the clock once

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
                CountdownRing(start: restStart, end: restStart.addingTimeInterval(90), accessibilityLabel: "Rest")
                    .frame(width: Size.minTouch * 3, height: Size.minTouch * 3)
                Button("Restart") { restStart = .now }  // ios-guard: allow catalog demo
                    .buttonStyle(.craft(.secondary))
            }
        case .animatedNumber:
            VStack(alignment: .leading, spacing: Space.sm) {
                AnimatedNumber(volume, format: .number.precision(.fractionLength(0))).font(.largeTitle)
                Button("Add a set") { volume += 1_080 }.buttonStyle(.craft(.secondary))
            }
        case .statTile:
            HStack(spacing: Space.md) {
                StatTile(label: "Volume", value: volume, unit: "lb", delta: StatDelta(verbatim: "+8%", tone: .success))
                StatTile(label: "Sessions", value: "2", delta: StatDelta("on track", tone: .neutral))
            }
        case .avatar:
            HStack(spacing: Space.md) {
                Avatar(name: "Sam Rivera", diameter: .small)
                Avatar(name: "Alex Kim")
                Avatar(name: "Jo Park", diameter: .large)
            }
        case .thumbnail:
            HStack(spacing: Space.md) {
                Thumbnail(systemName: "figure.strengthtraining.traditional", tone: .accent)
                Thumbnail(systemName: "play.rectangle", tone: .info, accessibilityLabel: "Video") {
                    ThumbnailBadge()
                }
            }
        default: EmptyView()
        }
    }
}
