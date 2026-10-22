import SwiftUI

/// Builds the planned workout page with its dependencies (DI-1).
struct PlannedWorkoutRoute: View {
    let planID: String
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        PlannedWorkoutScreen(
            viewModel: PlannedWorkoutViewModel(
                planID: planID,
                data: dependencies.appData,
                router: router,
                tabs: dependencies.tabs,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
    }
}
