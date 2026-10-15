import KoboTokens
import SwiftUI

/// Where a press fill draws relative to the pressed content.
enum PressFillLayer: Equatable {
    /// Over the content: a veil that also shows on opaque labels (`PressEffect.highlight`).
    case over
    /// Under the content: a row's background (`ListRow`).
    case under
}

extension View {
    /// The pressed fill of a row, tile or highlighted control: `color` in `shape`, in on `Motion.instant` and out on
    /// `Motion.exit`. A quick tap keeps the fill until its fade in ends (`PressFillSchedule`), so every tap shows it
    /// once. A fade moves nothing, so the fill still shows with Reduce Motion on; only its fades are cut.
    func pressFill(_ isPressed: Bool, in shape: AnyShape, color: Color, layer: PressFillLayer) -> some View {
        modifier(PressFillModifier(isPressed: isPressed, shape: shape, color: color, layer: layer))
    }
}

private struct PressFillModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var schedule = PressFillSchedule()
    let isPressed: Bool
    let shape: AnyShape
    let color: Color
    let layer: PressFillLayer

    func body(content: Content) -> some View {
        content
            .background {
                if layer == .under { fill }
            }
            .overlay {
                if layer == .over { fill }
            }
            .onChange(of: isPressed) { _, pressed in
                if pressed { pressIn() } else { release() }
            }
    }

    private var fill: some View {
        shape.fill(color).opacity(schedule.isShown ? 1 : 0).allowsHitTesting(false)
    }

    private func pressIn() {
        var next = schedule
        next.pressIn()
        let press = next.press
        withAnimation(Motion.instant.animation(reduceMotion: reduceMotion)) {
            schedule = next
        } completion: {
            withKoboAnimation(.exit, reduceMotion: reduceMotion) { schedule.arrived(press: press) }
        }
    }

    private func release() {
        withKoboAnimation(.exit, reduceMotion: reduceMotion) { schedule.release() }
    }
}
