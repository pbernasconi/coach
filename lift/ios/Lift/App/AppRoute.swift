import Foundation
import Observation

/// A screen pushed onto a tab's navigation stack.
nonisolated enum AppRoute: Hashable, Sendable {
    case workout(UUID)
    /// How to do a library exercise, and its recent history.
    case exercise(UUID)
    /// Every exercise in the bundled catalog, to browse and add from.
    case catalog
    /// One catalog exercise, by dataset id.
    case catalogExercise(String)
    /// Third-party work bundled with the app and its licences.
    case acknowledgements
    /// The day templates ("Upper A"), to plan workouts from.
    case templates
    /// One template's name and exercise slots.
    case template(UUID)
    /// Picks an exercise from the library or the catalog and adds it to a template or a session.
    case exercisePicker(ExercisePickerTarget)
    /// A finished session's duration, sets, volume and new bests.
    case workoutSummary(UUID)
}

/// Where the exercise picker adds the exercise it picks.
nonisolated enum ExercisePickerTarget: Hashable, Sendable {
    case template(UUID)
    case session(UUID)
}

/// Opens routes. ViewModels take this protocol, so tests can record what they opened (SCR-3).
protocol Navigating: AnyObject {
    func open(_ route: AppRoute)
    /// Closes the screen on top of the stack, as the back button does.
    func back()
}

/// The navigation path of one tab. Owned by the tab's view; handed to ViewModels as `any Navigating`.
@Observable
final class TabRouter: Navigating {
    var path: [AppRoute]

    init(path: [AppRoute] = []) {
        self.path = path
    }

    func open(_ route: AppRoute) {
        path.append(route)
    }

    func back() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }
}
