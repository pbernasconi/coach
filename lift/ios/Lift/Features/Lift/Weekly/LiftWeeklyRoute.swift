import SwiftUI

/// Builds the weekly volume screen with its dependencies (DI-1).
struct LiftWeeklyRoute: View {
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        LiftWeeklyScreen(
            viewModel: LiftWeeklyViewModel(
                data: dependencies.appData,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
    }
}
