import Foundation
import Observation

/// A screen pushed onto a tab's navigation stack.
nonisolated enum AppRoute: Hashable, Sendable {
    case workout(UUID)
    /// How to do a library exercise, and its recent history.
    case exercise(UUID)
    /// The same page opened from a workout: the coach's note for that workout's exercise shows at the top.
    case exerciseInWorkout(UUID, note: String)
    /// Every exercise in the bundled catalog, to browse and add from.
    case catalog
    /// One catalog exercise, by dataset id.
    case catalogExercise(String)
    /// Third-party work bundled with the app and its licences.
    case acknowledgements
    /// The gym's bars, plates and collars, from Settings.
    case plates
    /// The day templates ("Upper A"), to plan workouts from.
    case templates
    /// One template's name and exercise slots.
    case template(UUID)
    /// Picks an exercise from the library or the catalog and adds it to a template or a session.
    case exercisePicker(ExercisePickerTarget)
    /// A finished session's duration, sets, volume and new bests.
    case workoutSummary(UUID)
    /// One Strava activity from the coach (`/api/app/activities/{id}`), by its `activityId`.
    case activity(String)
    /// One Lift session as the coach shows it (`/api/app/lift/sessions/{id}`), by its lower-case `sessionId`. The
    /// screen opens the local workout instead for a session this iPhone has that is not finished.
    case liftSession(String)
    /// One exercise as the coach shows it (`/api/app/lift/exercises/{key}`), by its `exerciseKey`.
    case liftExercise(String)
    /// Volume per week as the coach shows it (`/api/app/lift/weekly`).
    case liftWeekly
    /// One planned workout as the coach shows it (`/api/app/plan/{id}`), by the Week API item's `id`.
    case plannedWorkout(String)
    /// One day's weigh-in as the coach shows it (`/api/app/weigh-ins/{date}`): `YYYY-MM-DD` or `latest`.
    case weighIn(String)
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
        guard path.last != route else { return }  // a double tap on a row pushes its screen once
        path.append(route)
    }

    func back() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }
}
