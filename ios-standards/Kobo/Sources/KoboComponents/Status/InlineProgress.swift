import KoboTokens
import SwiftUI

/// A thin linear progress bar in a tone: determinate (`value` of `total`) or indeterminate (a band sweeps the track).
/// For an upload, a sync, a multi-step import, inside a row or under a header. A screen-level wait is `LoadingState`
/// or a skeleton, never this. VoiceOver reads the label and the percentage, or "In progress".
///
///     InlineProgress(value: uploaded, total: size, accessibilityLabel: "Uploading photo")
///     InlineProgress(accessibilityLabel: "Syncing", tone: .info)
public struct InlineProgress: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let fraction: Double?
    private let tone: Tone
    private let label: Text

    /// A determinate bar: `value` of `total`, clamped to the track.
    public init(value: Double, total: Double = 1, tone: Tone = .accent, accessibilityLabel: LocalizedStringKey) {
        self.fraction = InlineProgressMath.fraction(value, total: total)
        self.tone = tone
        self.label = Text(accessibilityLabel)
    }

    /// An indeterminate bar, for work whose length is unknown.
    public init(accessibilityLabel: LocalizedStringKey, tone: Tone = .accent) {
        self.fraction = nil
        self.tone = tone
        self.label = Text(accessibilityLabel)
    }

    public var body: some View {
        Capsule()
            .fill(trackColor)
            .frame(height: Space.xs)
            .overlay(alignment: .leading) { indicator }
            .clipShape(Capsule())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(spokenValue)
            .accessibilityAddTraits(.updatesFrequently)
    }

    @ViewBuilder private var indicator: some View {
        if let fraction {
            Capsule()
                .fill(fillColor)
                .visualEffect { content, proxy in
                    content.offset(x: -(1 - fraction) * proxy.size.width)
                }
                .koboAnimation(.defaultSpatial, value: fraction)
        } else if reduceMotion {
            band(offset: (1 - InlineProgressMath.bandWidth) / 2)
        } else {
            TimelineView(.animation) { context in
                band(offset: InlineProgressMath.bandOffset(at: context.date.timeIntervalSinceReferenceDate))
            }
        }
    }

    /// The indeterminate band, drawn at `offset` (unit space) along the track.
    private func band(offset: Double) -> some View {
        let color = fillColor
        return Canvas { context, size in
            let rect = CGRect(
                x: offset * size.width,
                y: 0,
                width: InlineProgressMath.bandWidth * size.width,
                height: size.height
            )
            context.fill(Path(roundedRect: rect, cornerRadius: size.height / 2), with: .color(color))
        }
    }

    private var fillColor: Color { tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink }
    private var trackColor: Color { tone == .accent ? theme.palette.accentSoft : theme.palette.status(tone).soft }

    private var spokenValue: Text {
        guard let fraction else { return Text("In progress", bundle: .module) }
        return Text(fraction, format: .percent.precision(.fractionLength(0)))
    }
}

#if DEBUG
    private struct InlineProgressPreview: View {
        @State private var value = 0.4

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                InlineProgress(value: value, accessibilityLabel: "Uploading photo")
                InlineProgress(value: 3, total: 4, tone: .success, accessibilityLabel: "Import")
                InlineProgress(value: 0.9, tone: .warning, accessibilityLabel: "Storage used")
                InlineProgress(accessibilityLabel: "Syncing", tone: .info)
                Slider(value: $value)
            }
            .padding(Space.gutter)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Inline progress") { InlineProgressPreview() }
    #Preview("Inline progress · dark, Amber") { InlineProgressPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Inline progress · AX3") { InlineProgressPreview().dynamicTypeSize(.accessibility3) }
#endif
