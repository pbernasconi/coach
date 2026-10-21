import SwiftUI

/// Builds the Lift overview (the Lift tab's Overview segment) with its dependencies (DI-1).
struct LiftOverviewRoute: View {
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        LiftOverviewScreen(
            viewModel: LiftOverviewViewModel(
                data: dependencies.appData,
                router: router,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
    }
}
