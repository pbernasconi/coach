import Foundation
import LiftSync

/// Every intent on the activity page, named for what happened (SCR-1).
nonisolated enum ActivityDetailAction: Equatable, Sendable {
    case retryTapped
    /// Pull to refresh: also how the page catches up once Strava's details are in.
    case refreshPulled
    /// The header's arrows: the older or newer activity replaces this page.
    case neighbourTapped(String)
    /// Another activity on the same route.
    case activityTapped(String)
    /// The analysis charts' Distance | Time picker.
    case axisChanged(AnalysisAxis)
    /// The pace bars' Splits | Laps | Smoothed picker.
    case paceModeChanged(String)
    /// A summary card or a "See all" row: its page of full charts or tables.
    case panelTapped(ActivityPanel)
    case destinationDismissed
    /// "Open Settings" under the not-connected state.
    case connectTapped
    /// The "How did it feel" card.
    case feedback(WorkoutFeedbackAction)
    /// "Open session": the Lift session that completed a planned strength workout.
    case liftSessionTapped(String)
    /// "Start workout": a Lift session with the coach's exercises, sets and reps.
    case startWorkoutTapped
    /// "Mark done" (true), or "Not done" to put a workout marked by hand back (false).
    case doneToggled(Bool)
    /// "Move to another day" in the bar's "…": opens the day picker.
    case moveTapped
    /// A day picked in the day picker: the workout moves there.
    case moveDayPicked(Date)
    /// "Delete workout" in the bar's "…": asks first.
    case deleteTapped
    /// "Delete workout" in the question: the workout goes, and the page closes.
    case deleteConfirmed
    /// The pencil in the bar: the Edit sheet opens, filled in.
    case editTapped
    /// A field changed in the Edit sheet.
    case editChanged(WorkoutEditDraft)
    /// "Save" in the Edit sheet: the workout is saved, and the page reads it again.
    case editSaveTapped
}
