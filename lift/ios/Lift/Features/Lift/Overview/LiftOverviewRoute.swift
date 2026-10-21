import SwiftUI

/// Builds the Lift overview (the Lift tab's Overview segment) with its dependencies (DI-1).
enum LiftOverviewRoute {
    /// The overview's ViewModel. `LiftTabScreen` keeps one for as long as the tab lives, so switching segments keeps
    /// the loaded page and its folded sections instead of fetching again.
    @MainActor
    static func makeViewModel(dependencies: AppDependencies, router: any Navigating) -> LiftOverviewViewModel {
        LiftOverviewViewModel(
            data: dependencies.appData,
            router: router,
            tabs: dependencies.tabs,
            now: dependencies.now,
            calendar: dependencies.calendar
        )
    }
}
