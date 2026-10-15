import CraftTokens
import Foundation
import SwiftUI

extension View {
    /// A soft ring that keeps expanding and fading behind this view while `active`, for a "go" state that wants
    /// attention. With Reduce Motion on the ring holds still as a quiet halo, so the state still reads.
    ///
    ///     Text("GO").padding().background(theme.palette.accent, in: Circle()).pulse(active: isGo)
    ///
    /// - Parameters:
    ///   - shape: the outline of the ring; match the view's own shape.
    ///   - color: the ring colour; the theme accent when `nil`.
    public func pulse(active: Bool, in shape: some Shape = Circle(), color: Color? = nil) -> some View {
        modifier(PulseModifier(active: active, shape: shape, color: color))
    }
}

private struct PulseModifier<S: Shape>: ViewModifier {
    let active: Bool
    let shape: S
    let color: Color?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.craftTheme) private var theme

    func body(content: Content) -> some View {
        content.background {
            if active {
                if reduceMotion {
                    ring(spread: PulseMotion.reducedSpread, opacity: PulseMotion.reducedOpacity)
                } else {
                    TimelineView(.animation(minimumInterval: nil, paused: false)) { context in
                        let frame = PulseMotion.frame(at: context.date.timeIntervalSinceReferenceDate)
                        ring(spread: frame.spread, opacity: frame.opacity)
                    }
                }
            }
        }
    }

    private func ring(spread: CGFloat, opacity: Double) -> some View {
        shape
            .fill(color ?? theme.palette.accent)
            .padding(-spread)
            .opacity(opacity)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

private struct PulsePreview: View {
    @Environment(\.craftTheme) private var theme
    var body: some View {
        HStack(spacing: Space.xxl) {
            Text("GO")
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.onAccent)
                .frame(width: Size.thumbnail, height: Size.thumbnail)
                .background(theme.palette.accent, in: Circle())
                .pulse(active: true)
            Text("Start")
                .font(theme.font(.headline))
                .padding(.horizontal, Space.lg)
                .frame(minHeight: Size.minTouch)
                .background(theme.palette.accentSoft, in: Capsule())
                .pulse(active: true, in: Capsule())
        }
        .padding(Space.xxl)
    }
}

#Preview("Pulse") { PulsePreview().craftTheme(.lift) }
#Preview("Pulse, dark") { PulsePreview().craftTheme(.lift).preferredColorScheme(.dark) }
#Preview("Pulse, AX3") { PulsePreview().dynamicTypeSize(.accessibility3) }
