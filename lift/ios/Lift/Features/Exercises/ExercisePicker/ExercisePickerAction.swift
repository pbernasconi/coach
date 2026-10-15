import Foundation

/// Every user intent on the exercise picker, named for what happened (SCR-1).
nonisolated enum ExercisePickerAction: Equatable, Sendable {
    case queryChanged(String)
    /// "Your exercises" or "All exercises".
    case sourceChanged(ExercisePickerState.Source)
    /// A library row: adds that exercise and closes the picker.
    case libraryTapped(UUID)
    /// A catalog row: adds the entry to the library (or finds it there), adds it and closes the picker.
    case catalogTapped(String)
    /// A row with a catalog entry appeared: load its still once.
    case thumbnailNeeded(catalogID: String)
}
