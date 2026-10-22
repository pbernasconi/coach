import SwiftUI

/// Builds the weigh-in screen with its dependencies (DI-1): the screen a weigh-in notice opens (`lift://weigh-in/…`).
struct WeighInRoute: View {
    let day: String
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        WeighInScreen(
            viewModel: WeighInViewModel(
                day: day,
                data: dependencies.appData,
                router: router,
                tabs: dependencies.tabs,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
    }
}
