#if os(iOS)
    import KoboTokens
    import SwiftUI
    import UIKit

    /// Owns the scroll view and the hosted sheet, snaps releases to detents and runs the settle spring.
    final class BackdropSheetController: UIViewController, UIScrollViewDelegate {
        let model: BackdropSheetModel
        let hosted: UIViewController
        /// The detent last asked for or come to rest at.
        var detent: BackdropSheetDetent = .medium
        var revealFrom: BackdropSheetDetent?
        var frame = BackdropSheetFrame()
        var reduceMotion = false
        var onSettle: (BackdropSheetDetent) -> Void = { _ in }

        private let scrollView = UIScrollView()
        private var sheetTop: NSLayoutConstraint?
        private var sheetHeight: NSLayoutConstraint?
        private var placedHeight: CGFloat = 0
        private var spring: BackdropSheetSpring?
        private var springStart: CFTimeInterval?
        private var link: CADisplayLink?
        private let ticker = DisplayLinkTicker()

        init(model: BackdropSheetModel, hosted: UIViewController) {
            self.model = model
            self.hosted = hosted
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder _: NSCoder) { nil }

        private var math: BackdropSheetMath {
            BackdropSheetMath(
                height: Double(frame.size.height),
                expandedTop: Double(frame.topInset),
                mediumFraction: model.mediumFraction,
                peek: Double(model.peek)
            )
        }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .clear
            scrollView.backgroundColor = .clear
            scrollView.contentInsetAdjustmentBehavior = .never
            scrollView.showsVerticalScrollIndicator = false
            scrollView.alwaysBounceVertical = true
            scrollView.scrollsToTop = false
            scrollView.delegate = self
            scrollView.frame = view.bounds
            scrollView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(scrollView)
            addChild(hosted)
            hosted.view.backgroundColor = .clear
            hosted.view.translatesAutoresizingMaskIntoConstraints = false
            scrollView.addSubview(hosted.view)
            let top = hosted.view.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor)
            let height = hosted.view.heightAnchor.constraint(greaterThanOrEqualToConstant: 0)
            NSLayoutConstraint.activate([
                top, height,
                hosted.view.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
                hosted.view.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
                hosted.view.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
                hosted.view.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
            ])
            sheetTop = top
            sheetHeight = height
            hosted.didMove(toParent: self)
            ticker.onTick = { [weak self] link in self?.tick(link) }
            model.step = { [weak self] direction in self?.step(direction) }
        }

        /// The first layout with a real size puts the sheet at `revealFrom` (or its detent) before anything is drawn,
        /// then drops it to its detent; a new size puts it back at its detent.
        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            let height = frame.size.height
            guard height > model.peek * 2, height != placedHeight else { return }
            let math = math
            sheetTop?.constant = CGFloat(math.collapsedTop)
            sheetHeight?.constant = height - CGFloat(math.expandedTop)
            scrollView.layoutIfNeeded()
            let first = placedHeight == 0 ? revealFrom ?? detent : detent
            placedHeight = height
            stopSpring()
            model.frame = frame
            setOffset(math.offset(first))
            model.isPlaced = true
            if first != detent {
                glide(to: detent)
            } else {
                rest()
            }
        }

        /// The caller asked for a detent: glide there, unless a finger holds the sheet or it is already up with its
        /// content scrolled.
        func move(to new: BackdropSheetDetent) {
            detent = new
            guard placedHeight > 0, !scrollView.isTracking else { return }
            if new == .expanded, Double(scrollView.contentOffset.y) >= math.offset(.expanded) - 0.5 { return }
            glide(to: new)
        }

        private func glide(to detent: BackdropSheetDetent, velocity: Double = 0) {
            model.heading = detent
            model.resting = nil
            spring(to: math.offset(detent), velocity: velocity)
        }

        private func step(_ direction: Int) {
            let all = BackdropSheetDetent.allCases
            guard let index = all.firstIndex(of: detent) else { return }
            let next = all[min(max(index + direction, 0), all.count - 1)]
            move(to: next)
            onSettle(next)
        }

        // MARK: Scrolling

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            model.offset = scrollView.contentOffset.y
        }

        func scrollViewWillBeginDragging(_: UIScrollView) {
            stopSpring()
            model.heading = nil
            model.resting = nil
        }

        func scrollViewWillEndDragging(
            _ scrollView: UIScrollView,
            withVelocity velocity: CGPoint,
            targetContentOffset: UnsafeMutablePointer<CGPoint>
        ) {
            let math = math
            let offset = Double(scrollView.contentOffset.y)
            let speed = Double(velocity.y) * 1000
            let goal = math.target(from: offset, projected: Double(targetContentOffset.pointee.y), speed: speed)
            if offset >= math.offset(.expanded) - 0.5 || offset < 0 {
                // The content coasts as UIKit does, stopping at its top; a pull past the bottom bounces back.
                targetContentOffset.pointee.y = CGFloat(goal)
                model.heading = math.detent(at: goal)
                return
            }
            targetContentOffset.pointee = scrollView.contentOffset
            glide(to: math.detent(at: goal), velocity: speed)
        }

        func scrollViewDidEndDragging(_: UIScrollView, willDecelerate decelerate: Bool) {
            if !decelerate, spring == nil { rest() }
        }

        func scrollViewDidEndDecelerating(_: UIScrollView) {
            if spring == nil { rest() }
        }

        /// The sheet came to rest: tell the caller where.
        private func rest() {
            let resting = math.detent(at: Double(scrollView.contentOffset.y))
            model.resting = resting
            model.heading = resting
            detent = resting
            onSettle(resting)
        }

        private func setOffset(_ offset: Double) {
            scrollView.contentOffset.y = CGFloat(offset)
            model.offset = CGFloat(offset)
        }

        // MARK: Spring

        private func spring(to target: Double, velocity: Double) {
            let from = Double(scrollView.contentOffset.y)
            guard !reduceMotion, abs(from - target) > 0.5 else {
                setOffset(target)
                rest()
                return
            }
            spring = BackdropSheetSpring(from: from, to: target, velocity: velocity, response: Motion.Duration.sheet)
            // The clock starts at the first frame the display shows, so a slow first frame (a page still building)
            // does not eat the animation.
            springStart = nil
            guard link == nil else { return }
            let link = CADisplayLink(target: ticker, selector: #selector(DisplayLinkTicker.tick(_:)))
            link.add(to: .main, forMode: .common)
            self.link = link
        }

        private func tick(_ link: CADisplayLink) {
            guard let spring else { return }
            let start = springStart ?? link.timestamp
            springStart = start
            let time = link.targetTimestamp - start
            if spring.isSettled(at: time) {
                setOffset(spring.to)
                stopSpring()
                rest()
            } else {
                setOffset(spring.value(at: time))
            }
        }

        private func stopSpring() {
            spring = nil
            link?.invalidate()
            link = nil
        }
    }

    /// The display link's target: a display link keeps its target alive, so it holds this small object, not the
    /// controller.
    private final class DisplayLinkTicker: NSObject {
        var onTick: (CADisplayLink) -> Void = { _ in }

        @objc func tick(_ link: CADisplayLink) { onTick(link) }
    }
#endif
