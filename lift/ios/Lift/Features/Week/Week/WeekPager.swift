import KoboTokens
import SwiftUI
import UIKit

extension View {
    /// Pages the Week list with the finger: the list follows a horizontal drag (with resistance past the first and
    /// last week), a swipe far or fast enough slides it out and brings the next or last week in from the other side,
    /// and any other week change (the strip, the month) slides the new week in too. Reduce Motion fades instead. Only a
    /// sideways drag pages (`WeekSwipe`), so an up or down drag that starts on a workout card scrolls the list.
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
            .gesture(WeekSwipe(onChanged: dragChanged, onEnded: dragEnded))
            .onChange(of: offset) { old, new in slideIn(from: new > old ? width : -width) }
    }

    /// The list follows the finger; past the first or last week it moves a third as far, so the edge is felt.
    private func dragChanged(_ translation: CGFloat) {
        guard !isPaging else { return }
        let next = offset + (translation < 0 ? 1 : -1)
        dragX = translation * (range.contains(next) ? 1 : 0.3)
    }

    /// A swipe far or fast enough pages; anything else springs back.
    private func dragEnded(_ predicted: CGFloat) {
        guard !isPaging else { return }
        let next = offset + (predicted < 0 ? 1 : -1)
        guard abs(predicted) > width / 3, range.contains(next) else {
            withAnimation(Motion.fastSpatial.animation(reduceMotion: reduceMotion)) { dragX = 0 }
            return
        }
        slideOut(to: predicted < 0 ? -width : width, then: next)
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

/// The week swipe as a UIKit pan that only starts when the drag is more sideways than up or down. A SwiftUI
/// `DragGesture` on the list's content took part in every touch, so a vertical drag that began on a workout card often
/// pressed the card instead of scrolling. This pan fails at once on a vertical drag, which leaves it to the scroll view
/// (and cancels the card's press when it does start).
private struct WeekSwipe: UIGestureRecognizerRepresentable {
    /// The horizontal translation so far.
    let onChanged: (CGFloat) -> Void
    /// Where the swipe would come to rest at its release speed (0 when the pan was cancelled).
    let onEnded: (CGFloat) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.delegate = context.coordinator
        return pan
    }

    func handleUIGestureRecognizerAction(_ pan: UIPanGestureRecognizer, context: Context) {
        // Window coordinates: the content this is on moves with the finger.
        let x = pan.translation(in: nil).x
        switch pan.state {
        case .changed:
            onChanged(x)
        case .ended:
            onEnded(x + Self.glide(pan.velocity(in: nil).x))
        case .cancelled, .failed:
            onEnded(0)
        default:
            break
        }
    }

    /// How much further a release at `velocity` (points a second) carries, with UIKit's normal deceleration.
    private static func glide(_ velocity: CGFloat) -> CGFloat {
        let rate = UIScrollView.DecelerationRate.normal.rawValue
        return velocity / 1000 * rate / (1 - rate)
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        /// Starts only on a drag that is more sideways than vertical.
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
            let move = pan.translation(in: nil)
            let direction = move == .zero ? pan.velocity(in: nil) : move
            return abs(direction.x) > abs(direction.y)
        }

        /// The scroll view keeps its own pan, as with the old simultaneous gesture.
        func gestureRecognizer(
            _ recognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool {
            true
        }
    }
}
