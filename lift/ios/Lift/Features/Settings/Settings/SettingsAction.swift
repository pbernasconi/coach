import LiftCore

/// Every user intent on the Settings screen, named for what happened (SCR-1).
nonisolated enum SettingsAction: Equatable, Sendable {
    case unitSelected(WeightUnit)
    /// The Acknowledgements row: opens the list of bundled third-party work.
    case acknowledgementsTapped
    /// "Sync now": push then pull at once.
    case syncNowTapped
    /// The "Sync token" row: opens the token sheet.
    case tokenRowTapped
    case tokenDraftChanged(String)
    /// Saves the pasted token, then syncs.
    case tokenSaveTapped
    /// Deletes the stored token; sync stops until a new one is saved.
    case tokenRemoveTapped
    /// The token sheet was closed without saving.
    case tokenEditorDismissed
    /// The Apple Health switch: save finished workouts to Health, or stop.
    case healthToggled(Bool)
}
