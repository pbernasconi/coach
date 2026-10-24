import KoboTokens
import SwiftUI

/// A small strip of blocks laid end to end: each block's width is how long it lasts and its height how hard or high
/// it is, coloured calm to hot by level, or all in one quiet `color` when the shape is what matters. For a glance in a
/// list row it has no touch; given a `selection`, a tap or a drag picks a block (the others dim) and `highlighted`
/// lights the blocks of one step. VoiceOver reads the label the caller gives.
///
///     ProfileStrip(
///         segments: [
///             ProfileSegment(id: 0, width: 600, start: 0.5, level: 0),
///             ProfileSegment(id: 1, width: 300, start: 1.1, level: 4),
///         ],
///         accessibilityLabel: "Plan"
///     )
public struct ProfileStrip: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var scale: CGFloat = 1
    private let segments: [ProfileSegment]
    private let color: Color?
    private let height: CGFloat
    private let label: Text
    private var selection: Binding<Int?>?
    private var highlighted: Set<Int> = []

    /// - Parameters:
    ///   - color: one colour for every block; nil colours them by level.
    ///   - height: the strip's height at the default text size (it grows with Dynamic Type).
    public init(
        segments: [ProfileSegment],
        color: Color? = nil,
        height: CGFloat = Space.xxl,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.segments = segments
        self.color = color
        self.height = height
        self.label = Text(accessibilityLabel)
    }

    /// A strip whose accessibility label is shown as is (it names user data).
    public init(
        segments: [ProfileSegment],
        color: Color? = nil,
        height: CGFloat = Space.xxl,
        verbatimAccessibilityLabel: String
    ) {
        self.segments = segments
        self.color = color
        self.height = height
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    /// Lets a finger on the strip pick a block while it touches: the pick clears when the finger lifts, so the strip
    /// always rests unselected. `highlighted` lights a step's blocks while none is picked.
    public func selectable(_ selection: Binding<Int?>, highlighted: Set<Int> = []) -> ProfileStrip {
        var copy = self
        copy.selection = selection
        copy.highlighted = highlighted
        return copy
    }

    public var body: some View {
        let shapes = ProfileMath.shapes(segments)
        let ramp = [
            theme.palette.neutral.ink, theme.palette.info.ink, theme.palette.success.ink, theme.palette.warning.ink,
            theme.palette.danger.ink,
        ]
        Canvas { context, size in
            let focus: Set<Int> = selection?.wrappedValue.map { [$0] } ?? highlighted
            for (index, shape) in shapes.enumerated() {
                let isDim = !focus.isEmpty && !focus.contains(segments[index].id)
                // A hairline gap between blocks, dropped when a block is too narrow to keep it.
                let left = shape.x0 * size.width
                let right = shape.x1 * size.width
                let gap = right - left > Size.hairline * 6 ? Size.hairline : 0
                var path = Path()
                path.move(to: CGPoint(x: left + gap, y: size.height))
                path.addLine(to: CGPoint(x: left + gap, y: size.height * (1 - shape.top0)))
                path.addLine(to: CGPoint(x: right - gap, y: size.height * (1 - shape.top1)))
                path.addLine(to: CGPoint(x: right - gap, y: size.height))
                path.closeSubpath()
                context.fill(path, with: .color((color ?? ramp[shape.level]).opacity(isDim ? 0.25 : 0.85)))
            }
        }
        .frame(height: height * scale)
        .frame(maxWidth: .infinity)
        .overlay {
            if let selection {
                GeometryReader { proxy in
                    Color.clear
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0).onChanged { drag in
                                let x = Double(drag.location.x / max(proxy.size.width, 1))
                                if let id = ProfileMath.segment(at: min(max(x, 0), 1), in: segments),
                                    id != selection.wrappedValue
                                {
                                    selection.wrappedValue = id
                                }
                            }
                            .onEnded { _ in selection.wrappedValue = nil }
                        )
                }
            }
        }
        .koboFeedback(.selection, trigger: selection?.wrappedValue)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }
}

private struct ProfileStripPreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.lg) {
            ProfileStrip(
                segments: [
                    ProfileSegment(id: 0, width: 600, start: 0.5, end: 0.75, level: 1),
                    ProfileSegment(id: 1, width: 480, start: 1.0, level: 3),
                    ProfileSegment(id: 2, width: 180, start: 0.55, level: 0),
                    ProfileSegment(id: 3, width: 480, start: 1.0, level: 3),
                    ProfileSegment(id: 4, width: 180, start: 0.55, level: 0),
                    ProfileSegment(id: 5, width: 60, start: 1.2, level: 4),
                    ProfileSegment(id: 6, width: 600, start: 0.5, level: 0),
                ],
                accessibilityLabel: "Plan"
            )
            ProfileStrip(
                segments: [ProfileSegment(id: 0, width: 3_600, start: 0.7, level: 1)],
                accessibilityLabel: "Steady"
            )
            ProfileStrip(
                segments: [
                    ProfileSegment(id: 0, width: 600, start: 0.5, level: 0),
                    ProfileSegment(id: 1, width: 300, start: 1.1, level: 4),
                    ProfileSegment(id: 2, width: 600, start: 0.5, level: 0),
                ],
                color: theme.palette.textTertiary,
                accessibilityLabel: "One colour"
            )
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Profile strip") { ProfileStripPreview() }
    #Preview("Profile strip, dark") { ProfileStripPreview().preferredColorScheme(.dark) }
    #Preview("Profile strip, AX3") { ProfileStripPreview().dynamicTypeSize(.accessibility3) }
#endif
