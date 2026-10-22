import KoboTokens
import SwiftUI

extension View {
    /// Pages the Week list with the finger: the list follows a horizontal drag (with resistance past the first and
    /// last week), a swipe far or fast enough slides it out and brings the next or last week in from the other side,
    /// and any other week change (the strip, the month) slides the new week in too. Reduce Motion fades instead.
    func weekPager(offset: Int, range: ClosedRange<Int>, onChange: @escaping (Int) -> Void) -> some View {
        modifier(WeekPager(offset: offset, range: range, onChange: onChange))
    }
}

private struct WeekPager: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let offset: Int
    let range: ClosedRange<Int>
    let onChange: (Int) -> Void
    @State private var dragX: CGFloat = 0
    @State private var width: CGFloat = 0
    @State private var isPaging = false

    func body(content: Content) -> some View {
        content
            .offset(x: dragX)
            .opacity(reduceMotion ? 1 : 1 - min(abs(dragX) / max(width, 1), 1) * 0.4)
            .onGeometryChange(for: CGFloat.self) {
                $0.size.width
            } action: {
                width = $0
            }
            .simultaneousGesture(drag)
            .onChange(of: offset) { old, new in slideIn(from: new > old ? width : -width) }
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: Space.lg)
            .onChanged { value in
                guard !isPaging, abs(value.translation.width) > abs(value.translation.height) else { return }
                let next = offset + (value.translation.width < 0 ? 1 : -1)
                // Past the first or last week the list moves a third as far, so the edge is felt.
                dragX = value.translation.width * (range.contains(next) ? 1 : 0.3)
            }
            .onEnded { value in
                guard !isPaging else { return }
                let travel = value.predictedEndTranslation.width
                let next = offset + (travel < 0 ? 1 : -1)
                let isHorizontal = abs(value.translation.width) > abs(value.translation.height)
                guard isHorizontal, abs(travel) > width / 3, range.contains(next) else {
                    withAnimation(Motion.fastSpatial.animation(reduceMotion: reduceMotion)) { dragX = 0 }
                    return
                }
                slideOut(to: travel < 0 ? -width : width, then: next)
            }
    }

    /// Slides the shown week off the screen, then asks for the next one (whose arrival `slideIn` animates).
    private func slideOut(to x: CGFloat, then next: Int) {
        guard !reduceMotion else {
            dragX = 0
            onChange(next)
            return
        }
        isPaging = true
        withAnimation(Motion.fastSpatial.animation) {
            dragX = x
        } completion: {
            onChange(next)
        }
    }

    /// The new week starts just off the side it comes from and settles in place.
    private func slideIn(from x: CGFloat) {
        guard !reduceMotion else {
            dragX = 0
            isPaging = false
            return
        }
        var instant = Transaction()
        instant.disablesAnimations = true
        withTransaction(instant) { dragX = x }
        withAnimation(Motion.defaultSpatial.animation) {
            dragX = 0
        } completion: {
            isPaging = false
        }
    }
}
