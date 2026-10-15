import KoboTokens
import SwiftUI

/// A two-thumb slider over a `ClosedRange`: a filter such as "distance between 40 and 120 km". Thumbs snap to `step`
/// on a grid anchored at the lower bound, stay inside `bounds` and never cross; while they sit on one value the drag's
/// direction decides which moves. The title and the formatted range sit above the track. VoiceOver reads two
/// adjustable elements ("Minimum Distance, 40 km"; swipe up or down to step), and each change plays `feedback`.
///
///     RangeSlider("Distance", range: $distances, in: 0...200, step: 2.5) { "\($0.formatted()) km" }
///     RangeSlider(verbatim: filter.name, range: $nights, in: 1...30)
public struct RangeSlider: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @State private var active: RangeSliderMath.Thumb?
    @ScaledMetric(relativeTo: .body) private var knob = Size.iconLg + Space.xs
    private let title: Text
    private let range: Binding<ClosedRange<Double>>
    private let bounds: ClosedRange<Double>
    private let step: Double
    private let feedback: HapticFeedback?
    private let format: (Double) -> String

    /// A slider with a localized title. `format` writes each value (up to one decimal by default).
    public init(
        _ title: LocalizedStringKey,
        range: Binding<ClosedRange<Double>>,
        in bounds: ClosedRange<Double>,
        step: Double = 1,
        feedback: HapticFeedback? = .selection,
        format: @escaping (Double) -> String = RangeSlider.defaultFormat
    ) {
        self.init(Text(title), range, bounds, step, feedback, format)
    }

    /// A slider whose title is shown as is.
    public init(
        verbatim title: String,
        range: Binding<ClosedRange<Double>>,
        in bounds: ClosedRange<Double>,
        step: Double = 1,
        feedback: HapticFeedback? = .selection,
        format: @escaping (Double) -> String = RangeSlider.defaultFormat
    ) {
        self.init(Text(verbatim: title), range, bounds, step, feedback, format)
    }

    private init(
        _ title: Text,
        _ range: Binding<ClosedRange<Double>>,
        _ bounds: ClosedRange<Double>,
        _ step: Double,
        _ feedback: HapticFeedback?,
        _ format: @escaping (Double) -> String
    ) {
        self.title = title
        self.range = range
        self.bounds = bounds
        self.step = step
        self.feedback = feedback
        self.format = format
    }

    /// Up to one decimal, in the user's locale.
    nonisolated public static func defaultFormat(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }

    public var body: some View {
        let current = RangeSliderMath.normalized(range.wrappedValue, bounds: bounds, step: step)
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(alignment: .firstTextBaseline, spacing: Space.md) {
                title
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("\(format(current.lowerBound)) – \(format(current.upperBound))", bundle: .module)
                    .font(theme.font(.numeric))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .accessibilityHidden(true)
            GeometryReader { proxy in
                track(current, width: proxy.size.width)
            }
            .frame(height: Size.minTouch)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
        .koboFeedback(feedback, trigger: current)
    }

    private func track(_ current: ClosedRange<Double>, width: CGFloat) -> some View {
        let lowerX = x(current.lowerBound, width: width)
        let upperX = x(current.upperBound, width: width)
        return ZStack(alignment: .leading) {
            Capsule()
                .fill(theme.palette.surfaceSunken)
                .frame(width: max(width - knob, 0), height: Space.xs)
                .offset(x: knob / 2)
            Capsule()
                .fill(isEnabled ? theme.palette.accent : theme.palette.textTertiary)
                .frame(width: max(upperX - lowerX, 0), height: Space.xs)
                .offset(x: lowerX)
            thumb(.lower, current, at: lowerX, width: width)
            thumb(.upper, current, at: upperX, width: width)
        }
        .frame(width: width, height: Size.minTouch, alignment: .leading)
        .coordinateSpace(.named(Self.space))
        .allowsHitTesting(isEnabled)
    }

    private func thumb(
        _ which: RangeSliderMath.Thumb,
        _ current: ClosedRange<Double>,
        at center: CGFloat,
        width: CGFloat
    )
        -> some View
    {
        let value = which == .lower ? current.lowerBound : current.upperBound
        return RangeSliderKnob(diameter: knob, isActive: active == which)
            .frame(width: Size.minTouch, height: Size.minTouch)
            .contentShape(Rectangle())
            .offset(x: center - Size.minTouch / 2)
            .gesture(drag(which, width: width))
            .accessibilityElement()
            .accessibilityLabel(
                which == .lower ? Text("Minimum \(title)", bundle: .module) : Text("Maximum \(title)", bundle: .module)
            )
            .accessibilityValue(Text(verbatim: format(value)))
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: adjust(which, up: true)
                case .decrement: adjust(which, up: false)
                @unknown default: break
                }
            }
    }

    private func drag(_ grabbed: RangeSliderMath.Thumb, width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.space))
            .onChanged { gesture in
                let target = value(at: gesture.location.x, width: width)
                let thumb = active ?? RangeSliderMath.thumb(grabbed: grabbed, toward: target, range: range.wrappedValue)
                active = thumb
                range.wrappedValue = RangeSliderMath.moved(
                    thumb,
                    to: target,
                    range: range.wrappedValue,
                    bounds: bounds,
                    step: step
                )
            }
            .onEnded { _ in active = nil }
    }

    private func adjust(_ thumb: RangeSliderMath.Thumb, up: Bool) {
        range.wrappedValue = RangeSliderMath.stepped(
            thumb,
            up: up,
            range: range.wrappedValue,
            bounds: bounds,
            step: step
        )
    }

    /// The thumb centre for `value`: the ends sit half a knob in, so a thumb never leaves the track.
    private func x(_ value: Double, width: CGFloat) -> CGFloat {
        knob / 2 + max(width - knob, 0) * RangeSliderMath.fraction(of: value, in: bounds)
    }

    private func value(at location: CGFloat, width: CGFloat) -> Double {
        let usable = max(width - knob, 1)
        return RangeSliderMath.value(atFraction: (location - knob / 2) / usable, in: bounds)
    }

    private static let space = "RangeSliderTrack"
}

/// One round thumb: a light knob with a shadow and an accent rim, which grows a little while it is dragged.
private struct RangeSliderKnob: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isEnabled) private var isEnabled
    let diameter: CGFloat
    let isActive: Bool

    var body: some View {
        Circle()
            .fill(colorScheme == .dark ? theme.palette.textPrimary : theme.palette.surface)
            .overlay {
                Circle().strokeBorder(isEnabled ? theme.palette.accent : theme.palette.separator, lineWidth: Space.xxs)
            }
            .shadow(color: theme.palette.scrim, radius: Space.xxs, y: Space.xxs / 2)
            .frame(width: diameter, height: diameter)
            .scaleEffect(isActive ? 1 / PressMetrics.scale : 1)
            .koboAnimation(.snappy, value: isActive)
            .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct RangeSliderGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var distance = 40.0...120.0
        @State private var nights = 6.0...12.0
        @State private var stacked = 200.0...200.0

        var body: some View {
            VStack(spacing: Space.xxl) {
                RangeSlider("Distance", range: $distance, in: 0...200, step: 2.5) { "\(RangeSlider.defaultFormat($0)) km" }
                RangeSlider(verbatim: "Nights", range: $nights, in: 1...30)
                RangeSlider("Both at the top", range: $stacked, in: 0...200, step: 10)
                RangeSlider("Locked", range: .constant(20...60), in: 0...100).disabled(true)
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Range slider") { RangeSliderGallery() }
    #Preview("Range slider · dark, Amber") { RangeSliderGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Range slider · AX3") { RangeSliderGallery().dynamicTypeSize(.accessibility3) }
#endif
