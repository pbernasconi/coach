import KoboComponents
import KoboTokens
import SwiftUI

/// What every flow step shares around its scrolling body: the canvas, the measured height for the banner cap, the
/// pinned material footer, the inline bar title and the exit toolbar.
struct FlowStepChrome: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @State private var stepHeight: CGFloat = 0
    let barTitle: Text?
    let primary: FlowStepAction
    let secondary: FlowStepAction?
    let banner: FlowStepBanner?
    let submitState: LoadableStepState?
    let exit: FlowExitAction?
    let onBack: (() -> Void)?
    /// Fine print under the actions (a review's terms); `nil` for none.
    var footnote: Text?

    func body(content: Content) -> some View {
        content
            .scrollDismissesKeyboard(.interactively)
            .background(theme.palette.canvas)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { height in
                stepHeight = height
            }
            .pinnedFooter(style: .material) {
                FlowStepFooter(
                    primary: primary,
                    secondary: secondary,
                    banner: banner,
                    submitState: submitState,
                    footnote: footnote,
                    stepHeight: stepHeight
                )
            }
            .modifier(FlowBarTitle(title: barTitle))
            .flowExitToolbar(exit, onBack: onBack)
    }
}
