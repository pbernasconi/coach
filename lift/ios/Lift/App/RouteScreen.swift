import KoboComponents
import SwiftUI

/// Builds the screen for a pushed route and hands it the dependencies it needs (DI-1).
struct RouteScreen: View {
    let route: AppRoute
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        switch route {
        case .workout:
            EmptyState(symbol: "figure.strengthtraining.traditional", title: "Workout", message: "Coming soon.")
        }
    }
}
