import KoboComponents
import KoboTokens
import SwiftUI

extension EnvironmentValues {
    /// The position of the showing flow step. The app sets it on each step it pushes; previews and a flow presented on
    /// its own keep `.first`, so the ✕ shows.
    @Entry public var flowStepPosition: FlowStepPosition = .first

    /// A `flowExitToolbar` above already placed the ✕ for this screen.
    @Entry var flowExitInstalled = false
}
