#if os(iOS)
    import KoboTokens
    import SwiftUI
    import UIKit

    /// The scroll view under a `BackdropSheet`: UIKit, so the sheet is placed before its first frame and every settle is
    /// a spring that starts at the finger's release speed. SwiftUI's own scroll view snaps with the slow scroll
    /// deceleration and reports a placement made in code only on the next scroll.
    struct BackdropSheetScroller<Sheet: View>: UIViewControllerRepresentable {
        let model: BackdropSheetModel
        @Binding var detent: BackdropSheetDetent
        let revealFrom: BackdropSheetDetent?
        let frame: BackdropSheetFrame
        let sheet: Sheet

        func makeUIViewController(context: Context) -> BackdropSheetController {
            let hosting = UIHostingController(rootView: host(context))
            hosting.sizingOptions = [.intrinsicContentSize]
            hosting.safeAreaRegions = []
            let controller = BackdropSheetController(model: model, hosted: hosting)
            controller.detent = detent
            controller.revealFrom = revealFrom
            controller.frame = frame
            return controller
        }

        func updateUIViewController(_ controller: BackdropSheetController, context: Context) {
            (controller.hosted as? UIHostingController<BackdropSheetHost<Sheet>>)?.rootView = host(context)
            controller.reduceMotion = context.environment.accessibilityReduceMotion
            controller.onSettle = { new in if detent != new { detent = new } }
            if controller.frame != frame {
                controller.frame = frame
                controller.view.setNeedsLayout()
            }
            if controller.detent != detent { controller.move(to: detent) }
        }

        /// The hosted content gets the page's theme and calendar: a hosting controller does not inherit SwiftUI's
        /// environment (UIKit's traits carry the colour scheme, Dynamic Type and accessibility settings).
        private func host(_ context: Context) -> BackdropSheetHost<Sheet> {
            BackdropSheetHost(
                model: model,
                theme: context.environment.koboTheme,
                calendar: context.environment.calendar,
                locale: context.environment.locale,
                timeZone: context.environment.timeZone,
                content: sheet
            )
        }
    }
#endif
