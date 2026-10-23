import SwiftUI

#if os(iOS)
    import UIKit
#endif

extension View {
    /// Keeps the edge swipe that goes back on a pushed page that hides the system back button for its own (a chevron
    /// that changes, as on a map page). Hiding the back button turns that swipe off; this turns it on again while the page
    /// shows, and gives the navigation controller back its own handling when the page goes.
    ///
    ///     page
    ///         .navigationBarBackButtonHidden(true)
    ///         .keepsSwipeBack()
    public func keepsSwipeBack() -> some View {
        #if os(iOS)
            background(SwipeBackKeeper().frame(width: 0, height: 0).accessibilityHidden(true))
        #else
            self
        #endif
    }
}

#if os(iOS)
    /// A zero-size child controller: it reaches the page's navigation controller and lends the swipe a delegate.
    private struct SwipeBackKeeper: UIViewControllerRepresentable {
        func makeUIViewController(context _: Context) -> SwipeBackController { SwipeBackController() }

        func updateUIViewController(_: SwipeBackController, context _: Context) {}
    }

    private final class SwipeBackController: UIViewController, UIGestureRecognizerDelegate {
        /// The swipes this page lent a delegate to, with the delegates they had.
        private var lent: [(recognizer: UIGestureRecognizer, previous: (any UIGestureRecognizerDelegate)?)] = []
        private weak var navigation: UINavigationController?

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard lent.isEmpty, let navigation = findNavigation() else { return }
            self.navigation = navigation
            // Only the edge swipe: the full-width content swipe would take a sideways pan on a map or a chart.
            for swipe in [navigation.interactivePopGestureRecognizer].compactMap(\.self) {
                lent.append((swipe, swipe.delegate))
                swipe.delegate = self
                swipe.isEnabled = true
            }
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            for (swipe, previous) in lent { swipe.delegate = previous }
            lent = []
        }

        func gestureRecognizerShouldBegin(_: UIGestureRecognizer) -> Bool {
            (navigation?.viewControllers.count ?? 0) > 1
        }

        /// The navigation controller this page is in: up the parents, else up the responder chain.
        private func findNavigation() -> UINavigationController? {
            if let navigationController { return navigationController }
            var responder: UIResponder? = view
            while let next = responder?.next {
                if let navigation = next as? UINavigationController { return navigation }
                responder = next
            }
            return nil
        }
    }
#endif
