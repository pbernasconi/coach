import KoboComponents
import KoboTokens
import SwiftUI

extension View {
    /// The way out of one flow step: the ✕ (`exit`) where the step position shows it, and a back control. With
    /// `onBack` the step draws its own back chevron that calls it (a flow that moves between steps inside one screen)
    /// and hides the system one; without it, a later step keeps the system back chevron, which pops one step. A screen
    /// places the ✕ once: a nested `flowExitToolbar` adds none.
    ///
    ///     content.flowExitToolbar(FlowExitAction(hasUnsavedProgress: hasDraft, action: close), onBack: previous)
    public func flowExitToolbar(_ exit: FlowExitAction?, onBack: (() -> Void)? = nil) -> some View {
        modifier(FlowExitToolbar(exit: exit, onBack: onBack))
    }
}

private struct FlowExitToolbar: ViewModifier {
    @Environment(\.flowStepPosition) private var position
    @Environment(\.flowExitInstalled) private var isInstalledAbove
    let exit: FlowExitAction?
    let onBack: (() -> Void)?

    func body(content: Content) -> some View {
        let placement = FlowExitPlacement.placement(
            position: position,
            hasExit: exit != nil,
            isInstalledAbove: isInstalledAbove
        )
        content
            .environment(\.flowExitInstalled, isInstalledAbove || placement != .none)
            .navigationBarBackButtonHidden(FlowExitPlacement.hidesSystemBack(placement, hasCustomBack: showsBack))
            .toolbar {
                if showsBack, let onBack {
                    ToolbarItem(placement: .navigation) { HeaderButton(.back, action: onBack) }
                }
                if placement != .none, let exit {
                    ToolbarItem(placement: .primaryAction) { FlowExitButton(exit: exit) }
                }
            }
    }

    /// The step's own back chevron shows on every step after the first.
    private var showsBack: Bool { onBack != nil && position.showsBack }
}
